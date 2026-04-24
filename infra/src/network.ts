import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

export interface Network {
  vpcId: pulumi.Output<string>;
  privateSubnetIds: pulumi.Output<string[]>;
  lambdaSgId: pulumi.Output<string>;
  dbSgId: pulumi.Output<string>;
}

export const createNetwork = (): Network => {
  const vpc = new awsx.ec2.Vpc("nag", {
    numberOfAvailabilityZones: 2,
    natGateways: { strategy: awsx.ec2.NatGatewayStrategy.None },
    subnetStrategy: "Auto",
    enableDnsHostnames: true,
    enableDnsSupport: true,
  });

  const lambdaSg = new aws.ec2.SecurityGroup("nag-lambda", {
    vpcId: vpc.vpcId,
    description: "Nag Lambda egress",
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
  });

  const dbSg = new aws.ec2.SecurityGroup("nag-db", {
    vpcId: vpc.vpcId,
    description: "Nag Aurora: allow 5432 from Lambda SG only",
  });

  new aws.ec2.SecurityGroupRule("nag-db-ingress", {
    type: "ingress",
    securityGroupId: dbSg.id,
    sourceSecurityGroupId: lambdaSg.id,
    protocol: "tcp",
    fromPort: 5432,
    toPort: 5432,
  });

  return {
    vpcId: vpc.vpcId,
    privateSubnetIds: vpc.privateSubnetIds,
    lambdaSgId: lambdaSg.id,
    dbSgId: dbSg.id,
  };
};
