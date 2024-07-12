CREATE TABLE IF NOT EXISTS `info` (
	`key` text NOT NULL,
	`value` text NOT NULL
);
CREATE UNIQUE INDEX `info_key_unique` ON `info` (`key`);
INSERT INTO `info` (`key`, `value`) VALUES ('migration_version', '2');