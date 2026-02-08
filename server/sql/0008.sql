-- Add password column to users table for password-based authentication
ALTER TABLE `users` ADD COLUMN `password` text;
--> statement-breakpoint
UPDATE `info` SET `value` = '8' WHERE `key` = 'migration_version';
