CREATE TABLE `schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`day_of_week` integer,
	`day_of_month` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedule_goal_id_idx` ON `schedule` (`goal_id`);