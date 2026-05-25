-- Guest comments support
-- Recreate comments table with nullable user_id, add guest fields and approved flag
-- We ALTER can't change NOT NULL in SQLite, so we recreate the table.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `comments_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`user_id` integer,
	`content` text NOT NULL,
	`guest_name` text DEFAULT '',
	`guest_email` text DEFAULT '',
	`guest_website` text DEFAULT '',
	`approved` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
INSERT INTO `comments_new` (`id`, `feed_id`, `user_id`, `content`, `created_at`, `updated_at`)
	SELECT `id`, `feed_id`, `user_id`, `content`, `created_at`, `updated_at` FROM `comments`;

--> statement-breakpoint
DROP TABLE `comments`;

--> statement-breakpoint
ALTER TABLE `comments_new` RENAME TO `comments`;

--> statement-breakpoint
UPDATE `info` SET `value` = '10' WHERE `key` = 'migration_version';
