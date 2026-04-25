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
    // Single NAT Gateway gives the Lambda outbound internet egress so it
    // can reach Clerk's JWKS endpoint (and any other external HTTPS we
    // pick up later — push notifications, payment APIs, etc). Single
    // (not OnePerAz) is the cheap path: ~$33/month vs ~$66; not HA but
    // fine until traffic warrants it.
    natGateways: { strategy: awsx.ec2.NatGatewayStrategy.Single },
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
