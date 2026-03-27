CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`command_type` text NOT NULL,
	`payload` text,
	`timestamp` text NOT NULL
);
