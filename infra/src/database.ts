import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface DatabaseArgs {
  privateSubnetIds: pulumi.Output<string[]>;
  dbSgId: pulumi.Output<string>;
  minAcu: number;
  maxAcu: number;
}

export interface Database {
  endpoint: pulumi.Output<string>;
  databaseName: pulumi.Output<string>;
  masterUsername: pulumi.Output<string>;
  masterSecretArn: pulumi.Output<string>;
}

export const createDatabase = (args: DatabaseArgs): Database => {
  const subnetGroup = new aws.rds.SubnetGroup("nag", {
    subnetIds: args.privateSubnetIds,
  });

  const cluster = new aws.rds.Cluster("nag", {
    engine: "aurora-postgresql",
    engineMode: "provisioned",
    engineVersion: "17.4",
    databaseName: "nag",
    masterUsername: "nag",
    manageMasterUserPassword: true,
    dbSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: [args.dbSgId],
    storageEncrypted: true,
    backupRetentionPeriod: 7,
    preferredBackupWindow: "16:00-17:00",
    skipFinalSnapshot: false,
    finalSnapshotIdentifier: "nag-final",
    deletionProtection: true,
    serverlessv2ScalingConfiguration: {
      minCapacity: args.minAcu,
      maxCapacity: args.maxAcu,
    },
  });

  new aws.rds.ClusterInstance("nag-writer", {
    clusterIdentifier: cluster.id,
    instanceClass: "db.serverless",
    engine: "aurora-postgresql",
    engineVersion: cluster.engineVersion,
    publiclyAccessible: false,
  });

  const masterSecretArn = cluster.masterUserSecrets.apply(
    (s) => s[0]?.secretArn ?? "",
  );

  return {
    endpoint: cluster.endpoint,
    databaseName: cluster.databaseName.apply((n) => n ?? "nag"),
    masterUsername: cluster.masterUsername,
    masterSecretArn,
  };
};
