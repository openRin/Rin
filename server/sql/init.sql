CREATE TABLE IF NOT EXISTS `comments` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `feed_hashtags` (
	`feed_id` integer NOT NULL,
	`hashtag_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hashtag_id`) REFERENCES `hashtags`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `feeds` (
	`id` integer PRIMARY KEY NOT NULL,
	`alias` text,
	`title` text,
	`content` text NOT NULL,
    `summary` text DEFAULT '' NOT NULL,
	`listed` integer DEFAULT 1 NOT NULL,
	`draft` integer DEFAULT 1 NOT NULL,
	`uid` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `friends` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`desc` text,
	`avatar` text NOT NULL,
	`url` text NOT NULL,
	`uid` integer NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	`health` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `hashtags` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`openid` text NOT NULL,
	`avatar` text,
	`permission` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS `visits` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`ip` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `info` (
	`key` text NOT NULL,
	`value` text NOT NULL
);

CREATE UNIQUE INDEX `info_key_unique` ON `info` (`key`);

CREATE TABLE IF NOT EXISTS `moments` (
	`id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`uid` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `info` (`key`, `value`) VALUES ('migration_version', '4');

-- Insert a dummy user for testing
INSERT INTO `users` (`id`, `username`, `openid`, `permission`) VALUES (1, 'testuser', 'testopenid', 1);

-- Insert some dummy moments for testing
INSERT INTO `moments` (`content`, `uid`) VALUES ('Hello, this is a test moment!', 1);
INSERT INTO `moments` (`content`, `uid`) VALUES ('Another test moment with Markdown: **bold** and *italic*', 1);