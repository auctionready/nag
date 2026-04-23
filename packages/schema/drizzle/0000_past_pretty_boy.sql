CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`command_type` text NOT NULL,
	`payload` text,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `check_in` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`habit_id` integer NOT NULL,
	`timestamp` text NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habit`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
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
CREATE INDEX `schedule_goal_id_idx` ON `schedule` (`goal_id`);