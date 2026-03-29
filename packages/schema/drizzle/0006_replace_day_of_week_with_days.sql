ALTER TABLE `schedule` ADD `days` integer;--> statement-breakpoint
UPDATE `schedule` SET `days` = (1 << `day_of_week`) WHERE `day_of_week` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `schedule` DROP COLUMN `day_of_week`;
