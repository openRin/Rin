CREATE TABLE IF NOT EXISTS `info` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);

INSERT INTO `info` (`key`, `value`) VALUES ('migration_version', '2');