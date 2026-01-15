ALTER TABLE `feeds` ADD COLUMN `ai_summary` text DEFAULT '' NOT NULL;
-->statement-breakpoint
UPDATE `info` SET `value` = '5' WHERE `key` = 'migration_version';
