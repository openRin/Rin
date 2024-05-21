import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
function created_at() {
    return integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`);
}
function updated_at() {
    return integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`);
}
export const posts = sqliteTable("posts", {
    id: integer("id").primaryKey(),
    title: text("title"),
    content: text("content").notNull(),
    draft: integer("draft").default(1),
    createdAt: created_at(),
    updatedAt: updated_at(),
});

export const users = sqliteTable("users", {
    id: integer("id").primaryKey(),
    username: text("username").notNull(),
    openid: text("openid").notNull(),
    avatar: text("avatar"),
    permission: integer("permission").default(0),
    createdAt: created_at(),
    updatedAt: updated_at(),
});

export const comments = sqliteTable("comments", {
    id: integer("id").primaryKey(),
    postId: integer("post_id").references(()=> posts.id, { onDelete: 'cascade' }).notNull(),
    userId: integer("user_id").references(()=> users.id, { onDelete: 'cascade' }).notNull(),
    content: text("content").notNull(),
    createdAt: created_at(),
    updatedAt: updated_at(),
});

export const hashtags = sqliteTable("hashtags", {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: created_at(),
    updatedAt: updated_at(),
});

export const postHashtags = sqliteTable("post_hashtags", {
    postId: integer("post_id").references(()=> posts.id, { onDelete: 'cascade' }).notNull(),
    hashtagId: integer("hashtag_id").references(()=> hashtags.id, { onDelete: 'cascade' }).notNull(),
    createdAt: created_at(),
    updatedAt: updated_at(),
});