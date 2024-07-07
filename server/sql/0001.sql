CREATE TABLE IF NOT EXISTS `visits` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`ip` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
