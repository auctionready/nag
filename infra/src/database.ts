import * as neon from "@pulumi/neon";
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
  // Seconds of idle before the compute scales to zero. 0 = use Neon's
  // account default. -1 = never suspend.
  suspendTimeoutSeconds: number;
}

export interface Database {
  connectionUri: pulumi.Output<string>;
}

export const createDatabase = (args: DatabaseArgs): Database => {
  const provider = new neon.Provider("nag-neon", { apiKey: args.apiKey });

  const project = new neon.Project(
    "nag",
    {
      name: args.projectName,
      orgId: args.orgId,
      regionId: args.regionId,
      pgVersion: args.pgVersion,
      // Free-tier orgs cap at 6h (21600s). Default is 24h, which the API
      // rejects on create.
      historyRetentionSeconds: 21600,
      branch: {
        name: args.branchName,
        roleName: args.roleName,
        databaseName: args.databaseName,
      },
      defaultEndpointSettings: {
        autoscalingLimitMinCu: args.minCu,
        autoscalingLimitMaxCu: args.maxCu,
        suspendTimeoutSeconds: args.suspendTimeoutSeconds,
      },
    },
    { provider, protect: true },
  );

  return {
    connectionUri: pulumi.secret(project.connectionUri),
  };
};
