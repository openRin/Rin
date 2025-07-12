CREATE TABLE IF NOT EXISTS `moments` (
	`id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`uid` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
UPDATE `info` SET `value` = '4' WHERE `key` = 'migration_version';