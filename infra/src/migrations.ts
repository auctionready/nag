import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import * as path from "path";

export interface MigrationsArgs {
  databaseUrl: pulumi.Output<string>;
  // Re-run migrations whenever the Lambda zip content changes (i.e. on
  // every deploy). The hash flows in via `dependsOn` ordering AND via
  // `triggers` so Pulumi treats it as state input.
  lambdaSourceCodeHash: string;
  dependsOn: pulumi.Resource[];
}

// Production Marten runs with AutoCreateSchemaObjects = AutoCreate.None
// (Nag.Api/Program.cs) so cold starts skip pg_catalog introspection. That
// means schema changes are never applied on demand — this resource fills
// the gap by invoking Marten's `db-apply` JasperFx command after the DB
// and Lambda code are in place.
export const applyMigrations = (
  args: MigrationsArgs,
): command.local.Command => {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const scriptPath = path.join(
    repoRoot,
    "backend",
    "scripts",
    "apply-db-migrations.sh",
  );

  return new command.local.Command(
    "nag-db-apply",
    {
      create: scriptPath,
      update: scriptPath,
      environment: {
        DATABASE_URL: args.databaseUrl,
      },
      // Re-run on every code deploy or connection-uri change.
      triggers: [args.lambdaSourceCodeHash, args.databaseUrl],
    },
    { dependsOn: args.dependsOn },
  );
};
