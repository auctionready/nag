-- Hand-edited.
--
-- Stack 4 wire flip: outbox no longer stores per-command payloads.
-- Instead each row is a single envelope worth of past-tense events:
--   events = JSON `[{type, payload}, ...]`
--
-- Drop the now-redundant `command_type` column and rename `payload` →
-- `events`. SQLite supports both DDL forms in-place (3.25+ for rename,
-- 3.35+ for drop column). Pending rows from the old shape — if any —
-- become inert: the dispatcher reads `events` as JSON and an old
-- `payload` JSON object will fail to parse as an array, mark the row
-- with last_error, and stop the batch. Operators can clear them with
-- the existing Resume sync admin action after re-recording the intent.
ALTER TABLE `outbox` DROP COLUMN `command_type`;--> statement-breakpoint
ALTER TABLE `outbox` RENAME COLUMN `payload` TO `events`;
