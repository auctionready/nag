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
  // When set, the stack references this existing Neon project instead of
  // provisioning a new one — useful when two stacks (e.g. dev + prod) need
  // to share the same project during a transition.
  existingProjectId?: string;
}

export interface Database {
  connectionUri: pulumi.Output<string>;
}

export const createDatabase = (args: DatabaseArgs): Database => {
  const provider = new neon.Provider("nag-neon", { apiKey: args.apiKey });

  if (args.existingProjectId) {
    const project = neon.getProjectOutput(
      { id: args.existingProjectId },
      { provider },
    );
    return {
      connectionUri: pulumi.secret(project.connectionUri),
    };
  }

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
    {
      provider,
      protect: true,
      // Treat the project as create-only. On Neon's free tier, every
      // project-update API call is rejected with "editing maintenance
      // window preferences is not allowed for this account" because the
      // provider bundles maintenance-window settings into the request.
      // Ignoring drift on these fields keeps the prod deploy unblocked;
      // if/when this account is upgraded off the free tier the constraint
      // can be relaxed. Manage these settings in the Neon console.
      ignoreChanges: [
        "name",
        "branch",
        "defaultEndpointSettings",
        "historyRetentionSeconds",
      ],
    },
  );

  return {
    connectionUri: pulumi.secret(project.connectionUri),
  };
};
