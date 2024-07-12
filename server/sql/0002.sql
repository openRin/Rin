CREATE TABLE IF NOT EXISTS `info` (
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `info_key_unique` ON `info` (`key`);
--> statement-breakpoint
INSERT INTO `info` (`key`, `value`) VALUES ('migration_version', '2');