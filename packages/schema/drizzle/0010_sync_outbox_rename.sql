-- Hand-edited.
--
-- Two changes folded into one migration:
--
-- 1. Rename `audit_log` → `outbox`. The table has always functioned as
--    the outbox queue (rows transition pending → sent/failed); the old
--    name was misleading. SQLite supports table rename in-place; the
--    unique index has to be dropped and re-created under its new name.
--
-- 2. Add `sync_state.highest_server_sequence`. This is the high-water
--    mark for pull-sync (`GET /sync?since=<n>`). Backfill from the max
--    `server_sequence` already recorded in the outbox so a freshly-
--    migrated client doesn't re-pull events it already POSTed.
ALTER TABLE `audit_log` RENAME TO `outbox`;--> statement-breakpoint
DROP INDEX `audit_log_envelope_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_envelope_id_unique` ON `outbox` (`envelope_id`);--> statement-breakpoint
ALTER TABLE `sync_state` ADD `highest_server_sequence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `sync_state`
SET `highest_server_sequence` = COALESCE(
  (SELECT MAX(`server_sequence`) FROM `outbox` WHERE `server_sequence` IS NOT NULL),
  0
)
WHERE `id` = 1;
