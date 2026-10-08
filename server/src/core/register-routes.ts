import type { RinApp } from "./app-types";
import { AdminPluginService } from "../services/admin-plugins";
import { PluginConfigService } from "../services/plugin-config";
import { AdminUserService } from "../services/admin-users";
import { AdminFeedsService } from "../services/admin-feeds";
import { PasswordAuthService } from "../services/auth";
import { CommentService } from "../services/comments";
import { ConfigService } from "../services/config";
import { FaviconService } from "../services/favicon";
import { FeedService, SearchService, WordPressService } from "../services/feed";
import { FeedWriteApiService } from "../services/feed-write-api";
import { FriendService } from "../services/friends";
import { MomentsService } from "../services/moments";
import { RegistrationService } from "../services/registration";
import { RSSService } from "../services/rss";
import { SitemapService } from "../services/sitemap";
import { BlobService, StorageService } from "../services/storage";
import { TagService } from "../services/tag";
import { UserService } from "../services/user";
import { pluginRegistry } from "../plugins/registry";

export function registerRoutes(app: RinApp) {
  app.get("/", (c) => c.text("Hi"));

  app.route("/feed", FeedService());
  // 文章写入 API：与网页端创建文章分开，供脚本/CI 调用（结构化 JSON + dryRun）
  app.route("/feed-write", FeedWriteApiService());
  app.route("/search", SearchService());
  app.route("/wp", WordPressService());
  app.route("/tag", TagService());
  app.route("/comment", CommentService());
  app.route("/storage", StorageService());
  app.route("/blob", BlobService());
  app.route("/friend", FriendService());
  app.route("/moments", MomentsService());
  app.route("/user", UserService());
  // 管理员后台：用户列表 / 改权限 / 删除。每个端点内部独立校验 admin 标记。
  // 插件公开配置：前端插件组件读自己的设置用，无需鉴权（只返回插件声明过的公开键）
  app.route("/plugins", PluginConfigService());
  app.route("/admin/plugins", AdminPluginService());
  app.route("/admin", AdminUserService());
  // 管理员后台：全站文章统一管理（含草稿/未列出）与批量删除，端点内部独立校验 admin
  app.route("/admin", AdminFeedsService());
  app.route("/auth", PasswordAuthService());
  // 注册与登录共用 /auth 前缀：/auth/register/request、/auth/register/verify
  app.route("/auth", RegistrationService());
  app.route("/config", ConfigService());
  app.route("/", RSSService());
  app.route("/", SitemapService());
  app.route("/favicon", FaviconService());
  app.route("/favicon.ico", FaviconService());

  // 插件自定义路由挂到 /plugins/{插件名}/ 下。
  // 放在所有内置路由之后，避免插件意外覆盖既有端点。
  pluginRegistry.mountRoutes((path, subApp) => {
    app.route(path, subApp as never);
  });
}
