ALTER TABLE `feeds` ADD COLUMN `top` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feeds_alias_idx` ON `feeds` (`alias`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feeds_visibility_order_idx` ON `feeds` (`draft`, `listed`, `top`, `created_at`, `updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feeds_uid_idx` ON `feeds` (`uid`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visits_feed_created_at_idx` ON `visits` (`feed_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `friends_accepted_order_idx` ON `friends` (`accepted`, `sort_order`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_openid_idx` ON `users` (`openid`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_feed_created_at_idx` ON `comments` (`feed_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hashtags_name_idx` ON `hashtags` (`name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feed_hashtags_feed_hashtag_idx` ON `feed_hashtags` (`feed_id`, `hashtag_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feed_hashtags_hashtag_feed_idx` ON `feed_hashtags` (`hashtag_id`, `feed_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cache_type_key_idx` ON `cache` (`type`, `key`);
--> statement-breakpoint
UPDATE `info` SET `value` = '11' WHERE `key` = 'migration_version';
