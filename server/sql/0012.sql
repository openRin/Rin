-- Restore the `top` column on `feeds`.
--
-- Background: `top` was introduced in 690a21e ("feat: add top support") together
-- with a 0002.sql migration. Later 0002.sql was rewritten (b3907cf, then
-- aacb021 "fix: new database migration strategy") and the `ADD COLUMN` for
-- `top` was dropped, while src/db/schema.ts kept the field. The result is a
-- schema drift: the ORM expects `feeds.top` but no migration ever created it.
--
-- This stayed hidden because no migration SQL referenced `top` until 0011.sql
-- created `feeds_visibility_order_idx` on it. On databases that ran 0011
-- without the column, that CREATE INDEX fails (or is silently skipped by
-- `IF NOT EXISTS`, which only checks the index name -- not the columns).
--
-- Why a new 0012.sql instead of editing 0011.sql: the migration runner only
-- executes files whose version is strictly greater than the current
-- `migration_version` (see getMigrationFileVersion filter in
-- cli/src/tasks/db-migrate-local.ts and cli/src/tasks/deploy-cf.ts).
-- Databases already at version 11 would skip an edited 0011.sql entirely,
-- so the fix would never reach the databases that are actually broken.
--
-- Note: SQLite does not support `ADD COLUMN IF NOT EXISTS`. The runner's
-- `version > migrationVersion` filter already makes this idempotent in
-- practice: it runs once for any database below 12, and never again after
-- `migration_version` is set to 12 below.

ALTER TABLE `feeds` ADD COLUMN `top` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- `feeds_visibility_order_idx` from 0011.sql may be missing or may have been
-- created without `top` available. Recreate it now that the column exists.
DROP INDEX IF EXISTS `feeds_visibility_order_idx`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feeds_visibility_order_idx` ON `feeds` (`draft`, `listed`, `top`, `created_at`, `updated_at`);
--> statement-breakpoint

UPDATE `info` SET `value` = '12' WHERE `key` = 'migration_version';
