ALTER TABLE `comments` ADD COLUMN `parent_id` integer;
-->statement-breakpoint
ALTER TABLE `comments` ADD FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE cascade;
-->statement-breakpoint
UPDATE `info` SET `value` = '6' WHERE `key` = 'migration_version';
