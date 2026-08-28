-- The CLI migration preflight repairs feeds.top when it is missing. Keeping
-- that conditional check outside SQL avoids SQLite's unsupported
-- `ADD COLUMN IF NOT EXISTS` syntax and makes this migration safe for
-- databases where the column already exists.

DROP INDEX IF EXISTS `feeds_visibility_order_idx`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feeds_visibility_order_idx` ON `feeds` (`draft`, `listed`, `top`, `created_at`, `updated_at`);
--> statement-breakpoint
UPDATE `info` SET `value` = '12' WHERE `key` = 'migration_version';
