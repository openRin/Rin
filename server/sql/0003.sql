ALTER TABLE `friends` ADD COLUMN `sort_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '3' WHERE `key` = 'migration_version';