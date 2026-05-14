import type { RinApp } from "./app-types";
import { PasswordAuthService } from "../services/auth";
import { CommentService } from "../services/comments";
import { ConfigService } from "../services/config";
import { FaviconService } from "../services/favicon";
import { FeedService, SearchService, WordPressService } from "../services/feed";
import { FriendService } from "../services/friends";
import { MomentsService } from "../services/moments";
import { RSSService } from "../services/rss";
import { BlobService, StorageService } from "../services/storage";
import { TagService } from "../services/tag";
import { UserService } from "../services/user";

export function registerRoutes(app: RinApp) {
  app.get("/", (c) => c.text("Hi"));

  app.route("/feed", FeedService());
  app.route("/search", SearchService());
  app.route("/wp", WordPressService());
  app.route("/tag", TagService());
  app.route("/comment", CommentService());
  app.route("/storage", StorageService());
  app.route("/blob", BlobService());
  app.route("/friend", FriendService());
  app.route("/moments", MomentsService());
  app.route("/user", UserService());
  app.route("/auth", PasswordAuthService());
  app.route("/config", ConfigService());
  app.route("/", RSSService());
  app.route("/favicon", FaviconService());
  app.route("/favicon.ico", FaviconService());
}
