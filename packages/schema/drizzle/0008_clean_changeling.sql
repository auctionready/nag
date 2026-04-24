-- Hand-edited: the auto-generated migration assumed pristine state but
-- drizzle-kit lost track of migration 0007 (see _journal.json vs meta/
-- snapshots). That caused it to re-emit an ALTER TABLE `schedule` ADD
-- `reminder` statement that would fail on any DB already at 0007 — removed.
--
-- Also hand-edited to make the new NOT NULL columns addable to tables with
-- existing rows: columns are added nullable, backfilled with UUIDs via the
-- randomblob v4 trick, then uniqueness is enforced. The schema declares
-- .notNull() and $defaultFn(() => crypto.randomUUID()) so new inserts are
-- safe; SQLite cannot retroactively tighten NOT NULL without a table
-- rebuild, and the application guarantees the invariant going forward.

-- sync_state: single-row flag table.
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`halted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `sync_state` (`id`, `halted`) VALUES (1, 0);
--> statement-breakpoint
-- audit_log: add envelope_id (idempotency key), status, sent_at,
-- server_sequence, last_error columns. Pre-existing rows predate server
-- sync and must NOT be replayed, so they are marked `sent` at backfill
-- time. Their envelope_id is still populated (unique constraint below).
ALTER TABLE `audit_log` ADD `envelope_id` text;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `sent_at` text;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `server_sequence` integer;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `last_error` text;--> statement-breakpoint
UPDATE `audit_log`
SET
  `envelope_id` = lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  ),
  `status` = 'sent',
  `sent_at` = `timestamp`
WHERE `envelope_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_log_envelope_id_unique` ON `audit_log` (`envelope_id`);
--> statement-breakpoint
-- habit.external_id: stable UUID for server-side references.
ALTER TABLE `habit` ADD `external_id` text;--> statement-breakpoint
UPDATE `habit`
SET `external_id` = lower(
  hex(randomblob(4)) || '-' ||
  hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
)
WHERE `external_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_external_id_unique` ON `habit` (`external_id`);
--> statement-breakpoint
-- check_in.external_id: same as habit.
ALTER TABLE `check_in` ADD `external_id` text;--> statement-breakpoint
UPDATE `check_in`
SET `external_id` = lower(
  hex(randomblob(4)) || '-' ||
  hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
)
WHERE `external_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `check_in_external_id_unique` ON `check_in` (`external_id`);
