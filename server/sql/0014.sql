-- Feed IDs switch to text: new posts get uuids by default (feed.id_mode = uuid),
-- numeric mode stays available. Existing posts are remapped to uuids, except the
-- `about` page which keeps its numeric id so bookmarks keep working.
--
-- Prerequisite: migrations 0000-0013 applied (the column list below matches that
-- schema exactly; databases with extra custom columns would lose those columns).
--
-- SQLite cannot ALTER a PRIMARY KEY type, so the feeds table and every child
-- table referencing it (visits, visit_stats, comments, feed_hashtags) are rebuilt.
-- A mapping table carries old -> new ids across the rebuild.

CREATE TABLE `feed_id_map` (
    `old_id` integer PRIMARY KEY,
    `new_id` text NOT NULL
);
--> statement-breakpoint

INSERT INTO `feed_id_map`
SELECT `id`,
       CASE WHEN `alias` = 'about'
            THEN CAST(`id` AS TEXT)
            ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
                 lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
                 lower(hex(randomblob(6)))
       END
FROM `feeds`;
--> statement-breakpoint

ALTER TABLE `feeds` RENAME TO `feeds_old`;
--> statement-breakpoint

CREATE TABLE `feeds` (
    `id` text PRIMARY KEY,
    `alias` text,
    `title` text,
    `summary` text DEFAULT '' NOT NULL,
    `ai_summary` text DEFAULT '' NOT NULL,
    `ai_summary_status` text DEFAULT 'idle' NOT NULL,
    `ai_summary_error` text DEFAULT '' NOT NULL,
    `content` text NOT NULL,
    `listed` integer DEFAULT 1 NOT NULL,
    `draft` integer DEFAULT 1 NOT NULL,
    `top` integer DEFAULT 0 NOT NULL,
    `uid` integer NOT NULL REFERENCES `users`(`id`),
    `created_at` integer DEFAULT (unixepoch()) NOT NULL,
    `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

INSERT INTO `feeds` (
    `id`, `alias`, `title`, `summary`, `ai_summary`, `ai_summary_status`, `ai_summary_error`,
    `content`, `listed`, `draft`, `top`, `uid`, `created_at`, `updated_at`
)
SELECT
    m.`new_id`, f.`alias`, f.`title`, f.`summary`, f.`ai_summary`, f.`ai_summary_status`, f.`ai_summary_error`,
    f.`content`, f.`listed`, f.`draft`, f.`top`, f.`uid`, f.`created_at`, f.`updated_at`
FROM `feeds_old` f
JOIN `feed_id_map` m ON m.`old_id` = f.`id`;
--> statement-breakpoint

-- 注意：RENAME 后旧索引跟随 feeds_old，须等旧表删除后才能用同名重建

ALTER TABLE `visits` RENAME TO `visits_old`;
--> statement-breakpoint
CREATE TABLE `visits` (
    `id` integer PRIMARY KEY,
    `feed_id` text NOT NULL REFERENCES `feeds`(`id`) ON DELETE cascade,
    `ip` text NOT NULL,
    `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `visits` (`id`, `feed_id`, `ip`, `created_at`)
SELECT v.`id`, m.`new_id`, v.`ip`, v.`created_at`
FROM `visits_old` v
JOIN `feed_id_map` m ON m.`old_id` = v.`feed_id`;
--> statement-breakpoint
DROP TABLE `visits_old`;
--> statement-breakpoint
CREATE INDEX `visits_feed_created_at_idx` ON `visits` (`feed_id`, `created_at`);
--> statement-breakpoint

ALTER TABLE `visit_stats` RENAME TO `visit_stats_old`;
--> statement-breakpoint
CREATE TABLE `visit_stats` (
    `feed_id` text PRIMARY KEY REFERENCES `feeds`(`id`) ON DELETE cascade,
    `pv` integer DEFAULT 0 NOT NULL,
    `hll_data` text DEFAULT '' NOT NULL,
    `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `visit_stats` (`feed_id`, `pv`, `hll_data`, `updated_at`)
SELECT m.`new_id`, s.`pv`, s.`hll_data`, s.`updated_at`
FROM `visit_stats_old` s
JOIN `feed_id_map` m ON m.`old_id` = s.`feed_id`;
--> statement-breakpoint
DROP TABLE `visit_stats_old`;
--> statement-breakpoint

ALTER TABLE `comments` RENAME TO `comments_old`;
--> statement-breakpoint
CREATE TABLE `comments` (
    `id` integer PRIMARY KEY,
    `feed_id` text NOT NULL REFERENCES `feeds`(`id`) ON DELETE cascade,
    `user_id` integer REFERENCES `users`(`id`) ON DELETE cascade,
    `content` text NOT NULL,
    `guest_name` text DEFAULT '',
    `guest_email` text DEFAULT '',
    `guest_website` text DEFAULT '',
    `approved` integer DEFAULT 1 NOT NULL,
    `created_at` integer DEFAULT (unixepoch()) NOT NULL,
    `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `comments` (
    `id`, `feed_id`, `user_id`, `content`, `guest_name`, `guest_email`, `guest_website`,
    `approved`, `created_at`, `updated_at`
)
SELECT
    c.`id`, m.`new_id`, c.`user_id`, c.`content`, c.`guest_name`, c.`guest_email`, c.`guest_website`,
    c.`approved`, c.`created_at`, c.`updated_at`
FROM `comments_old` c
JOIN `feed_id_map` m ON m.`old_id` = c.`feed_id`;
--> statement-breakpoint
DROP TABLE `comments_old`;
--> statement-breakpoint
CREATE INDEX `comments_feed_created_at_idx` ON `comments` (`feed_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `comments_approved_feed_created_at_idx` ON `comments` (`approved`, `feed_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `comments_approved_created_at_idx` ON `comments` (`approved`, `created_at`);
--> statement-breakpoint

ALTER TABLE `feed_hashtags` RENAME TO `feed_hashtags_old`;
--> statement-breakpoint
CREATE TABLE `feed_hashtags` (
    `feed_id` text NOT NULL REFERENCES `feeds`(`id`) ON DELETE cascade,
    `hashtag_id` integer NOT NULL REFERENCES `hashtags`(`id`) ON DELETE cascade,
    `created_at` integer DEFAULT (unixepoch()) NOT NULL,
    `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `feed_hashtags` (`feed_id`, `hashtag_id`, `created_at`, `updated_at`)
SELECT m.`new_id`, h.`hashtag_id`, h.`created_at`, h.`updated_at`
FROM `feed_hashtags_old` h
JOIN `feed_id_map` m ON m.`old_id` = h.`feed_id`;
--> statement-breakpoint
DROP TABLE `feed_hashtags_old`;
--> statement-breakpoint
CREATE INDEX `feed_hashtags_feed_hashtag_idx` ON `feed_hashtags` (`feed_id`, `hashtag_id`);
--> statement-breakpoint
CREATE INDEX `feed_hashtags_hashtag_feed_idx` ON `feed_hashtags` (`hashtag_id`, `feed_id`);
--> statement-breakpoint

DROP TABLE `feed_id_map`;
--> statement-breakpoint
DROP TABLE `feeds_old`;
--> statement-breakpoint

CREATE INDEX `feeds_alias_idx` ON `feeds` (`alias`);
--> statement-breakpoint
CREATE INDEX `feeds_visibility_order_idx` ON `feeds` (`draft`, `listed`, `top`, `created_at`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `feeds_uid_idx` ON `feeds` (`uid`);
--> statement-breakpoint

-- upsert：个别库可能没有 migration_version 行，缺行时插入而不是漏更
INSERT INTO `info` (`key`, `value`) VALUES ('migration_version', '14')
ON CONFLICT(`key`) DO UPDATE SET `value` = '14';
