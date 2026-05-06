import * as neon from "pulumi-neon";
import * as pulumi from "@pulumi/pulumi";

export interface DatabaseArgs {
  apiKey: pulumi.Output<string>;
  orgId: string;
  regionId: string;
  pgVersion: number;
  projectName: string;
  branchName: string;
  databaseName: string;
  roleName: string;
  minCu: number;
  maxCu: number;
  // Seconds of idle before the compute scales to zero. 0 means "use Neon's
  // account default"; pass a positive integer to override.
  suspendTimeoutSeconds: number;
}

export interface Database {
  endpoint: pulumi.Output<string>;
  databaseName: pulumi.Output<string>;
  masterUsername: pulumi.Output<string>;
  masterPassword: pulumi.Output<string>;
}

const fetchNeonPassword = async (
  apiKey: string,
  projectId: string,
  roleName: string,
  databaseName: string,
): Promise<string> => {
  const url = new URL(
    `https://console.neon.tech/api/v2/projects/${projectId}/connection_uri`,
  );
  url.searchParams.set("role_name", roleName);
  url.searchParams.set("database_name", databaseName);
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    throw new Error(`Neon connection_uri ${resp.status}: ${await resp.text()}`);
  }
  const { uri } = (await resp.json()) as { uri: string };
  return decodeURIComponent(new URL(uri).password);
};

export const createDatabase = (args: DatabaseArgs): Database => {
  const provider = new neon.Provider("nag-neon", { token: args.apiKey });

  const project = new neon.Project(
    "nag",
    {
      name: args.projectName,
      orgId: args.orgId,
      regionId: args.regionId,
      pgVersion: args.pgVersion,
      branch: {
        name: args.branchName,
        endpoint: {
          minCu: args.minCu,
          maxCu: args.maxCu,
          suspendTimeout: args.suspendTimeoutSeconds,
        },
      },
    },
    { provider, protect: true },
  );

  const branchId = project.branch.apply((b) => b.id);

  // Role + Database are created once and then frozen. branchId is
  // replace-only on both resources — a Neon "restore from snapshot"
  // creates a new branch with a new ID, which would normally trigger
  // destroy+recreate (drop the database, rotate the password). Ignored
  // here, and made harmless by *not* reading anything off the resources
  // downstream: the password is fetched fresh via the Neon REST API on
  // every run against whichever branch is currently `main`. So a
  // restore is invisible — the role/db on the new branch are snapshot
  // copies with the same password, the API fetch returns it, the
  // Lambda env stays valid.
  const role = new neon.Role(
    "nag",
    { projectId: project.id, branchId, name: args.roleName },
    { provider, protect: true, ignoreChanges: ["branchId"] },
  );

  const database = new neon.Database(
    "nag",
    {
      projectId: project.id,
      branchId,
      name: args.databaseName,
      ownerName: role.name,
    },
    { provider, protect: true, ignoreChanges: ["branchId"] },
  );

  // pulumi.all on role.id/database.id ensures the password fetch waits
  // for both to exist on the first `up` (no race against role creation).
  const password = pulumi
    .all([args.apiKey, project.id, role.id, database.id])
    .apply(([apiKey, projectId]) =>
      fetchNeonPassword(apiKey, projectId, args.roleName, args.databaseName),
    );

  return {
    endpoint: project.branch.apply((b) => b.endpoint.host),
    databaseName: pulumi.output(args.databaseName),
    masterUsername: pulumi.output(args.roleName),
    masterPassword: pulumi.secret(password),
  };
};
