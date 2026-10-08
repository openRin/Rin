import { Hono } from "hono";
import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { users, comments } from "../db/schema";
import { AUTH_ERROR_CODES, t, validateSchema } from "@rin/api";
import { bizError } from "../errors";

/**
 * 管理员专属服务：用户列表 / 改权限 / 删除。
 * 关键约束：每端点独立校验 admin；不允许操作自己（降权/删除会把自己锁在门外）；
 * 禁止操作内置管理员（`admin:` 前缀，唯一救援通道）；like 查询转义通配符。
 */

const ADMIN_OPENID_PREFIX = "admin:";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** 合法权限值：0=普通用户，1=管理员 */
const PERMISSION_VALUES = ['0', '1'] as const;

/** 转义 LIKE 通配符，让用户输入的 % 和 _ 按字面匹配 */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

export function AdminUserService(): Hono {
  const app = new Hono();

  /** 统一的管理员校验，未通过时抛 403 */
  function requireAdmin(c: AppContext) {
    if (!c.get('admin')) {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Administrator permission required', 403);
    }
  }

  /** 取目标用户，同时挡住「操作自己」和「操作内置管理员」 */
  async function getMutableUser(c: AppContext, id: number) {
    const db = c.get('db');
    const currentUserId = c.get('uid');

    if (currentUserId === id) {
      // 不能改自己：降权会立刻失去后台权限，删除则无法恢复
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Cannot modify your own account', 400);
    }

    const user = await profileAsync(c, 'admin_user_lookup', () =>
      db.query.users.findFirst({ where: eq(users.id, id) }),
    );

    if (!user) {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'User not found', 404);
    }

    if (user.openid.startsWith(ADMIN_OPENID_PREFIX)) {
      // 内置管理员是唯一的救援通道，不能从后台删掉
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Cannot modify the built-in administrator', 400);
    }

    return user;
  }

  // GET /admin/users?page=1&size=20&keyword=xxx
  app.get('/users', async (c: AppContext) => {
    requireAdmin(c);
    const db = c.get('db');

    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(c.req.query('size')) || DEFAULT_PAGE_SIZE));
    const keyword = (c.req.query('keyword') || '').trim();
    const offset = (page - 1) * size;

    // 搜索命中用户名、邮箱或 openid
    const where = keyword
      ? or(
        like(users.username, `%${escapeLike(keyword)}%`),
        like(users.email, `%${escapeLike(keyword)}%`),
        like(users.openid, `%${escapeLike(keyword)}%`),
      )
      : undefined;

    const [rows, totalResult] = await profileAsync(c, 'admin_users_query', () =>
      Promise.all([
        db
          .select({
            id: users.id,
            username: users.username,
            avatar: users.avatar,
            email: users.email,
            emailVerified: users.emailVerified,
            permission: users.permission,
            createdAt: users.createdAt,
            // 标注账号来源：邮箱注册 vs OAuth，便于管理员判断
            viaEmail: sql<number>`CASE WHEN ${users.openid} LIKE 'email:%' THEN 1 ELSE 0 END`,
          })
          .from(users)
          .where(where)
          .orderBy(desc(users.id))
          .limit(size)
          .offset(offset),
        db.select({ value: count() }).from(users).where(where),
      ]),
    );

    const total = totalResult[0]?.value ?? 0;

    return c.json({
      users: rows,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
    });
  });

  // GET /admin/users/:id — 单个用户详情，含评论数
  app.get('/users/:id', async (c: AppContext) => {
    requireAdmin(c);
    const db = c.get('db');
    const id = Number(c.req.param('id'));

    if (!Number.isInteger(id) || id <= 0) {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Invalid user id', 400);
    }

    const [user, commentCount] = await profileAsync(c, 'admin_user_detail', () =>
      Promise.all([
        db.query.users.findFirst({ where: eq(users.id, id) }),
        db.select({ value: count() }).from(comments).where(eq(comments.userId, id)),
      ]),
    );

    if (!user) {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'User not found', 404);
    }

    return c.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      emailVerified: user.emailVerified,
      permission: user.permission,
      createdAt: user.createdAt,
      commentCount: commentCount[0]?.value ?? 0,
    });
  });

  // PUT /admin/users/:id — 修改权限（0=普通用户，1=管理员）
  app.put('/users/:id', async (c: AppContext) => {
    requireAdmin(c);
    const id = Number(c.req.param('id'));

    // 复用共享 schema 做校验，契约变更能被强制
    const validation = validateSchema<AdminUserUpdateInput>(
      adminUserUpdateSchema,
      await c.req.json(),
    );
    if (!validation.success) {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Invalid payload', 400, validation.issues);
    }

    const user = await getMutableUser(c, id);
    const db = c.get('db');

    await profileAsync(c, 'admin_user_update', () =>
      db
        .update(users)
        .set({ permission: Number(validation.data.permission) })
        .where(eq(users.id, id)),
    );

    return c.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        permission: Number(validation.data.permission),
      },
    });
  });

  // DELETE /admin/users/:id — 删除用户及其评论
  app.delete('/users/:id', async (c: AppContext) => {
    requireAdmin(c);
    const id = Number(c.req.param('id'));

    const user = await getMutableUser(c, id);
    const db = c.get('db');

    // comments 表对 user_id 配了 ON DELETE CASCADE，
    // 但显式先删一次：这样即便 D1 上的外键未强制，也能真正清干净
    await profileAsync(c, 'admin_user_delete', async () => {
      await db.delete(comments).where(eq(comments.userId, id));
      await db.delete(users).where(eq(users.id, id));
    });

    return c.json({ success: true, deleted: { id: user.id, username: user.username } });
  });

  return app;
}

/**
 * 管理员修改用户的请求体，只允许改 permission。
 * 权限用字符串枚举（'0' | '1'）：schema-validator 的 t.Number() 不支持 min/max，
 * 显式列出合法值比留一个可写入任意数字的口子更安全。
 */
const adminUserUpdateSchema = t.Object({
  permission: t.String({ enum: PERMISSION_VALUES }),
});

/** 请求体解析结果。权限值已由 schema 约束为合法字符串 */
type AdminUserUpdateInput = { permission: string };
