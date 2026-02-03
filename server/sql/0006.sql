CREATE TABLE IF NOT EXISTS `visit_stats` (
	`feed_id` integer PRIMARY KEY NOT NULL,
	`pv` integer DEFAULT 0 NOT NULL,
	`hll_data` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
-->statement-breakpoint
-- Migrate existing data from visits table to visit_stats
INSERT INTO `visit_stats` (`feed_id`, `pv`, `hll_data`, `updated_at`)
SELECT 
	`feed_id`,
	COUNT(*) as pv,
	'' as hll_data,
	unixepoch() as updated_at
FROM `visits`
GROUP BY `feed_id`;
-->statement-breakpoint
UPDATE `info` SET `value` = '6' WHERE `key` = 'migration_version';
