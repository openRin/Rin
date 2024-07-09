CREATE TABLE IF NOT EXISTS `feeds_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`alias` text,
	`title` text,
	`content` text NOT NULL,
    `summary` text DEFAULT '' NOT NULL,
	`listed` integer DEFAULT 1 NOT NULL,
	`draft` integer DEFAULT 1 NOT NULL,
	`uid` integer NOT NULL,
    `top` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `feeds_new` (`id`, `alias`, `title`, `content`, `summary`, `listed`, `draft`, `uid`, `created_at`, `updated_at`)
SELECT `id`, `alias`, `title`, `content`, `summary`, `listed`, `draft`, `uid`, `created_at`, `updated_at`
FROM `feeds`;
--> statement-breakpoint
DROP TABLE `feeds`;
--> statement-breakpoint
ALTER TABLE `feeds_new` RENAME TO `feeds`;