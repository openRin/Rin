-- Email registration support: users gain an email column plus a verification-code table.
--
-- SQLite cannot express `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and unlike the
-- comments.user_id migration (0010) we do not need to relax a NOT NULL constraint,
-- so plain ALTER TABLE is safe here. Fresh installs get these columns from 0000.sql
-- in the CLI-generated schema, while existing databases apply this file.

ALTER TABLE `users` ADD COLUMN `email` text DEFAULT '';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_verified` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Email uniqueness only needs to hold for accounts that actually own an address.
-- A plain UNIQUE index would break every GitHub-only account on the empty-string
-- default, so use a partial index scoped to non-empty values (SQLite supports these
-- since 3.8.0, and D1 is well past that).
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`) WHERE `email` <> '';
--> statement-breakpoint

-- Pending comment reviews are filtered on (feed_id, approved, created_at); the
-- existing index on (feed_id, created_at) no longer serves that access path well.
CREATE INDEX IF NOT EXISTS `comments_approved_feed_created_at_idx` ON `comments` (`approved`, `feed_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_approved_created_at_idx` ON `comments` (`approved`, `created_at`);
--> statement-breakpoint

UPDATE `info` SET `value` = '13' WHERE `key` = 'migration_version';
