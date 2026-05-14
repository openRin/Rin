CREATE TABLE IF NOT EXISTS `cache` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`type` text DEFAULT 'cache' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cache_key_type_unique` ON `cache` (`key`,`type`);
-->statement-breakpoint
UPDATE `info` SET `value` = '7' WHERE `key` = 'migration_version';