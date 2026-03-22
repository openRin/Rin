ALTER TABLE `feeds` ADD COLUMN `ai_summary_status` text DEFAULT 'idle' NOT NULL;
--> statement-breakpoint
ALTER TABLE `feeds` ADD COLUMN `ai_summary_error` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '9' WHERE `key` = 'migration_version';
