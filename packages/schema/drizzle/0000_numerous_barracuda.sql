CREATE TABLE `check_in` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`habit_id` integer NOT NULL,
	`timestamp` text NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habit`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_in_external_id_unique` ON `check_in` (`external_id`);--> statement-breakpoint
CREATE INDEX `check_in_habit_id_idx` ON `check_in` (`habit_id`);--> statement-breakpoint
CREATE INDEX `check_in_timestamp_idx` ON `check_in` (`timestamp`);--> statement-breakpoint
CREATE TABLE `goal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`habit_id` integer NOT NULL,
	`regularity` text NOT NULL,
	`frequency` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habit`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_habit_id_idx` ON `goal` (`habit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `goal_habit_regularity_uniq` ON `goal` (`habit_id`,`regularity`);--> statement-breakpoint
CREATE TABLE `habit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_external_id_unique` ON `habit` (`external_id`);--> statement-breakpoint
CREATE TABLE `identity` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`device_id` text NOT NULL,
	`account_id` text,
	`registered_at` text
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`envelope_id` text NOT NULL,
	`events` text NOT NULL,
	`timestamp` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` text,
	`server_sequence` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_envelope_id_unique` ON `outbox` (`envelope_id`);--> statement-breakpoint
CREATE TABLE `schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`days` integer,
	`day_of_month` integer,
	`reminder` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedule_goal_id_idx` ON `schedule` (`goal_id`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`halted` integer DEFAULT false NOT NULL,
	`highest_server_sequence` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `sync_state` (`id`, `halted`, `highest_server_sequence`) VALUES (1, 0, 0);
