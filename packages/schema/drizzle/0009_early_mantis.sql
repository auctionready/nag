CREATE TABLE `identity` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`device_id` text NOT NULL,
	`account_id` text,
	`registered_at` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`halted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sync_state`("id", "halted") SELECT "id", "halted" FROM `sync_state`;--> statement-breakpoint
DROP TABLE `sync_state`;--> statement-breakpoint
ALTER TABLE `__new_sync_state` RENAME TO `sync_state`;--> statement-breakpoint
PRAGMA foreign_keys=ON;