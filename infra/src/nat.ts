// Cost-minimized NAT instance for Lambda outbound (Clerk JWKS discovery).
//
// Why an instance and not a NAT Gateway:
//   - NAT Gateway is ~US$33/mo + per-GB processing in ap-southeast-2.
//   - This stack's only outbound need is the Clerk OIDC discovery doc + JWKS
//     (a few KB, cached in-process). A t4g.nano (~US$3/mo) is sufficient.
//
// Caveats (read before editing):
//   1. Single AZ, single point of failure. The instance lives in one public
//      subnet; both private subnets default-route through its ENI. If the
//      instance or its AZ dies, Clerk-protected endpoints fail closed until
//      it is replaced. Public + API-key endpoints are unaffected.
//   2. No auto-recovery. There is no Auto Scaling group / no CloudWatch
//      alarm wrapping the instance. To self-heal, wrap it in an ASG of size 1
//      (fck-nat's HA recipe) — adds ~15 lines, no extra steady-state cost.
//   3. Cross-AZ data transfer (~US$0.01/GB) applies to Lambda invocations in
//      the AZ that does not host the NAT. Negligible for the JWKS workload.
//   4. fck-nat AMI is community-maintained, not AWS-supported. The AMI is
//      published in account 568608671756; we look it up by name. Pin the
//      filter pattern carefully and review fck-nat releases before bumping.
//   5. EIP idle billing applies if the instance is destroyed but the EIP is
//      retained. `pulumi destroy` here removes both — don't split them.
//
// Switching back to a managed NAT Gateway (when availability matters more
// than cost):
//   - In `network.ts`, set
//       natGateways: { strategy: awsx.ec2.NatGatewayStrategy.OnePerAz }
//     (or `Single` for one shared NAT, still single-AZ failure domain).
//   - In `index.ts`, remove the `createNat({...})` call.
//   - Delete this file.
//   - `pulumi up` — Pulumi destroys the NAT instance + EIP + routes, awsx
//     creates the NAT Gateway(s) and rewires the private route tables.

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface NatArgs {
  vpcId: pulumi.Output<string>;
  vpcCidr: pulumi.Output<string>;
  publicSubnetIds: pulumi.Output<string[]>;
  privateSubnetIds: pulumi.Output<string[]>;
  // Number of private subnets created by awsx (matches
  // numberOfAvailabilityZones in network.ts). Hardcoded so we can register
  // the per-subnet routes at plan time without `apply()` antipatterns.
  privateSubnetCount: number;
  instanceType?: string;
}

export interface Nat {
  instanceId: pulumi.Output<string>;
  publicIp: pulumi.Output<string>;
}

export const createNat = (args: NatArgs): Nat => {
  // fck-nat AMI lookup. Owner ID is the published fck-nat account; the name
  // pattern matches their ARM64 / Amazon Linux 2023 release line.
  // See https://fck-nat.dev/ — verify the owner + name pattern before edits.
  const ami = aws.ec2.getAmiOutput({
    owners: ["568608671756"],
    mostRecent: true,
    filters: [
      { name: "name", values: ["fck-nat-al2023-hvm-*-arm64-ebs"] },
      { name: "state", values: ["available"] },
    ],
  });

  const sg = new aws.ec2.SecurityGroup("nag-nat", {
    vpcId: args.vpcId,
    description: "Nag NAT instance: allow VPC ingress, all egress",
    ingress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: [args.vpcCidr],
      },
    ],
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
  });

  // SSM Session Manager only — no SSH key, no bastion. Shell in with:
  //   aws ssm start-session --target <instance-id> --region ap-southeast-2
  const role = new aws.iam.Role("nag-nat", {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "ec2.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
  });

  new aws.iam.RolePolicyAttachment("nag-nat-ssm", {
    role: role.name,
    policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  });

  const profile = new aws.iam.InstanceProfile("nag-nat", { role: role.name });

  // Pin to the first public subnet. AZ ordering may shift on VPC rebuilds —
  // routing is unaffected since both private route tables target this ENI.
  const subnetId = args.publicSubnetIds.apply((ids) => ids[0]);

  const instance = new aws.ec2.Instance("nag-nat", {
    ami: ami.id,
    instanceType: args.instanceType ?? "t4g.nano",
    subnetId,
    vpcSecurityGroupIds: [sg.id],
    iamInstanceProfile: profile.name,
    // Required: without this, the ENI silently drops forwarded packets.
    sourceDestCheck: false,
    tags: { Name: "nag-nat" },
  });

  const eip = new aws.ec2.Eip("nag-nat", { domain: "vpc" });
  new aws.ec2.EipAssociation("nag-nat", {
    instanceId: instance.id,
    allocationId: eip.allocationId,
  });

  // For each private subnet, look up its route table and add a default
  // route through the NAT ENI. The count is fixed by network.ts — iterate
  // at plan time so resources register deterministically (no `apply()`
  // wrapping `new` calls).
  for (let i = 0; i < args.privateSubnetCount; i++) {
    const privateSubnetId = args.privateSubnetIds.apply((ids) => ids[i]);
    const routeTable = aws.ec2.getRouteTableOutput({
      subnetId: privateSubnetId,
    });
    new aws.ec2.Route(`nag-nat-default-${i}`, {
      // Cross-AZ data transfer (~US$0.01/GB) applies when this subnet is in
      // a different AZ to the NAT instance. Negligible for JWKS traffic.
      routeTableId: routeTable.routeTableId,
      destinationCidrBlock: "0.0.0.0/0",
      networkInterfaceId: instance.primaryNetworkInterfaceId,
    });
  }

  return {
    instanceId: instance.id,
    publicIp: eip.publicIp,
  };
};
