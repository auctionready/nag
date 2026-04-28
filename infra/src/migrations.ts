import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import * as path from "path";

export interface MigrationsArgs {
  dbEndpoint: pulumi.Output<string>;
  dbName: pulumi.Output<string>;
  dbUsername: pulumi.Output<string>;
  dbPassword: pulumi.Output<string>;
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
// and Lambda code are in place. It re-runs whenever the Lambda zip
// hashes differently (i.e. every code deploy) or the DB password rotates.
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
        DB_HOST: args.dbEndpoint,
        DB_NAME: args.dbName,
        DB_USERNAME: args.dbUsername,
        DB_PASSWORD: args.dbPassword,
      },
      // Re-run on every code deploy or DB password rotation.
      triggers: [args.lambdaSourceCodeHash, args.dbPassword],
    },
    { dependsOn: args.dependsOn },
  );
};
