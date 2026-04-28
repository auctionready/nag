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
  const endpointHost = project.branch.apply((b) => b.endpoint.host);

  const role = new neon.Role(
    "nag",
    {
      projectId: project.id,
      branchId,
      name: args.roleName,
    },
    { provider },
  );

  const database = new neon.Database(
    "nag",
    {
      projectId: project.id,
      branchId,
      name: args.databaseName,
      ownerName: role.name,
    },
    { provider },
  );

  return {
    endpoint: endpointHost,
    databaseName: database.name,
    masterUsername: role.name,
    masterPassword: role.password,
  };
};
