import journal from "./meta/_journal.json";

const m0000 = `CREATE TABLE \`check_in\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`habit_id\` integer NOT NULL,
\t\`timestamp\` text NOT NULL,
\t\`created_at\` text NOT NULL,
\t\`updated_at\` text NOT NULL,
\tFOREIGN KEY (\`habit_id\`) REFERENCES \`habit\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`check_in_habit_id_idx\` ON \`check_in\` (\`habit_id\`);--> statement-breakpoint
CREATE INDEX \`check_in_timestamp_idx\` ON \`check_in\` (\`timestamp\`);--> statement-breakpoint
CREATE TABLE \`goal\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`habit_id\` integer NOT NULL,
\t\`regularity\` text NOT NULL,
\t\`count\` integer NOT NULL,
\t\`created_at\` text NOT NULL,
\t\`updated_at\` text NOT NULL,
\tFOREIGN KEY (\`habit_id\`) REFERENCES \`habit\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`goal_habit_id_idx\` ON \`goal\` (\`habit_id\`);--> statement-breakpoint
CREATE UNIQUE INDEX \`goal_habit_regularity_uniq\` ON \`goal\` (\`habit_id\`,\`regularity\`);--> statement-breakpoint
CREATE TABLE \`habit\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`title\` text NOT NULL,
\t\`description\` text NOT NULL,
\t\`icon\` text,
\t\`created_at\` text NOT NULL,
\t\`updated_at\` text NOT NULL
);`;

export default {
  journal,
  migrations: {
    m0000,
  },
};
