import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { setupTestApp, cleanupTestDB } from "../../../tests/fixtures";
import { AdminUserService } from "../admin-users";
import type { Variables } from "../../core/hono-types";

/**
 * 管理员用户管理测试，重点覆盖「不可逆操作」的安全边界：
 * 不能改/删自己、不能删内置管理员、权限值必须 0/1、LIKE 通配符要转义。
 */
describe("AdminUserService", () => {
  let sqlite: Database;
  let env: Env;
  let app: any;

  beforeEach(async () => {
    const ctx = await setupTestApp(AdminUserService);
    sqlite = ctx.sqlite;
    env = ctx.env;
    app = ctx.app;

    // admin(内置, 不可动) / target(可操作) / other(可操作)
    sqlite.exec(`
      INSERT INTO users (id, username, openid, permission, email, email_verified)
      VALUES (1, 'admin', 'admin:root', 1, '', 0);
      INSERT INTO users (id, username, openid, permission, email, email_verified)
      VALUES (2, 'target', 'email:target@example.com', 0, 'target@example.com', 1);
      INSERT INTO users (id, username, openid, permission, email, email_verified)
      VALUES (3, 'other', 'gh_other', 0, '', 0);
    `);
  });

  afterEach(() => {
    cleanupTestDB(sqlite);
  });

  /** 以指定登录用户身份发请求。mock_token_<id> 对应 users.id */
  const asUser = (id: number) => ({ Authorization: `Bearer mock_token_${id}` });

  describe("GET /users", () => {
    it("should list users for an admin", async () => {
      const res = await app.request("/users", { method: "GET", headers: asUser(1) }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.users.length).toBe(3);
      expect(body.pagination.total).toBe(3);
    });

    it("should reject a non-admin caller", async () => {
      const res = await app.request("/users", { method: "GET", headers: asUser(2) }, env);
      expect(res.status).toBe(403);
    });

    it("should reject an anonymous caller", async () => {
      const res = await app.request("/users", { method: "GET" }, env);
      expect(res.status).toBe(403);
    });

    it("should mark email-registered accounts", async () => {
      const res = await app.request("/users", { method: "GET", headers: asUser(1) }, env);
      const body = await res.json() as any;

      const target = body.users.find((u: any) => u.id === 2);
      const other = body.users.find((u: any) => u.id === 3);
      expect(target.viaEmail).toBe(1);
      expect(other.viaEmail).toBe(0);
    });

    it("should search by username", async () => {
      const res = await app.request("/users?keyword=targ", { method: "GET", headers: asUser(1) }, env);
      const body = await res.json() as any;

      expect(body.users.length).toBe(1);
      expect(body.users[0].username).toBe("target");
    });

    it("should search by email", async () => {
      const res = await app.request("/users?keyword=target@example.com", { method: "GET", headers: asUser(1) }, env);
      const body = await res.json() as any;
      expect(body.users.length).toBe(1);
    });

    it("should treat LIKE wildcards in the keyword as literal text", async () => {
      // 若不转义，搜 % 会匹配所有用户；转义后应搜不到任何东西
      const res = await app.request("/users?keyword=%25", { method: "GET", headers: asUser(1) }, env);
      const body = await res.json() as any;

      expect(body.users.length).toBe(0);
    });

    it("should paginate", async () => {
      const res = await app.request("/users?page=1&size=2", { method: "GET", headers: asUser(1) }, env);
      const body = await res.json() as any;

      expect(body.users.length).toBe(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.totalPages).toBe(2);
    });
  });

  describe("PUT /users/:id", () => {
    it("should promote a user", async () => {
      const res = await app.request("/users/2", {
        method: "PUT",
        headers: { ...asUser(1), "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "1" }),
      }, env);

      expect(res.status).toBe(200);
      const row = sqlite.prepare("SELECT permission FROM users WHERE id = 2").get() as any;
      expect(row.permission).toBe(1);
    });

    it("should refuse to modify your own account", async () => {
      // admin 把自己降权后就进不了后台，属于把自己锁在门外
      const res = await app.request("/users/1", {
        method: "PUT",
        headers: { ...asUser(1), "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "0" }),
      }, env);

      expect(res.status).toBe(400);
      const row = sqlite.prepare("SELECT permission FROM users WHERE id = 1").get() as any;
      expect(row.permission).toBe(1);
    });

    it("should reject an invalid permission value", async () => {
      const res = await app.request("/users/2", {
        method: "PUT",
        headers: { ...asUser(1), "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "999" }),
      }, env);

      expect(res.status).toBe(400);
    });

    it("should reject a missing permission field", async () => {
      const res = await app.request("/users/2", {
        method: "PUT",
        headers: { ...asUser(1), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
    });

    it("should reject a non-admin caller", async () => {
      const res = await app.request("/users/3", {
        method: "PUT",
        headers: { ...asUser(2), "Content-Type": "application/json" },
        body: JSON.stringify({ permission: "1" }),
      }, env);

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /users/:id", () => {
    it("should delete a user and their comments", async () => {
      sqlite.exec(`
        INSERT INTO comments (id, feed_id, user_id, content, approved)
        VALUES (50, 1, 2, 'will be cascaded', 1);
      `);

      const res = await app.request("/users/2", { method: "DELETE", headers: asUser(1) }, env);

      expect(res.status).toBe(200);
      const userCount = sqlite.prepare("SELECT COUNT(*) as c FROM users WHERE id = 2").get() as any;
      expect(userCount.c).toBe(0);

      // 评论应一并删除，不能留下指向不存在用户的孤儿数据
      const commentCount = sqlite.prepare("SELECT COUNT(*) as c FROM comments WHERE user_id = 2").get() as any;
      expect(commentCount.c).toBe(0);
    });

    it("should refuse to delete your own account", async () => {
      const res = await app.request("/users/1", { method: "DELETE", headers: asUser(1) }, env);

      expect(res.status).toBe(400);
      const count = sqlite.prepare("SELECT COUNT(*) as c FROM users WHERE id = 1").get() as any;
      expect(count.c).toBe(1);
    });

    it("should refuse to delete the built-in administrator", async () => {
      // openid 以 admin: 开头的是内置账号，删掉后就没有救援通道了
      sqlite.exec(`UPDATE users SET openid = 'admin:root' WHERE id = 1`);

      const res = await app.request("/users/1", { method: "DELETE", headers: asUser(1) }, env);
      expect(res.status).toBe(400);
    });

    it("should return 404 for a non-existent user", async () => {
      const res = await app.request("/users/999", { method: "DELETE", headers: asUser(1) }, env);
      expect(res.status).toBe(404);
    });

    it("should reject a non-admin caller", async () => {
      const res = await app.request("/users/3", { method: "DELETE", headers: asUser(2) }, env);
      expect(res.status).toBe(403);

      const count = sqlite.prepare("SELECT COUNT(*) as c FROM users WHERE id = 3").get() as any;
      expect(count.c).toBe(1);
    });
  });
});
