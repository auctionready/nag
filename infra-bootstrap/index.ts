import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("nag-bootstrap");
const githubOrg = cfg.get("githubOrg") ?? "auctionready";
const githubRepo = cfg.get("githubRepo") ?? "nag";

const splitCsv = (s: string | undefined): string[] =>
  (s ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

const allowedRefs = splitCsv(cfg.get("allowedRefs"));
const allowedEnvironments = splitCsv(cfg.get("allowedEnvironments"));

const oidcProvider = new aws.iam.OpenIdConnectProvider("github", {
  url: "https://token.actions.githubusercontent.com",
  clientIdLists: ["sts.amazonaws.com"],
  // GitHub's OIDC thumbprint is validated by AWS against the IAM endpoint,
  // so providing any well-known value is accepted. AWS recommends this one.
  thumbprintLists: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
});

const subjects: string[] = [
  ...allowedRefs.map((r) => `repo:${githubOrg}/${githubRepo}:ref:${r}`),
  ...allowedEnvironments.map(
    (e) => `repo:${githubOrg}/${githubRepo}:environment:${e}`,
  ),
];

if (subjects.length === 0) {
  throw new Error(
    "nag-bootstrap:allowedRefs or nag-bootstrap:allowedEnvironments must list at least one entry.",
  );
}

const role = new aws.iam.Role("nag-github-deploy", {
  name: "nag-github-deploy",
  assumeRolePolicy: oidcProvider.arn.apply((providerArn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Federated: providerArn },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            },
            StringLike: {
              "token.actions.githubusercontent.com:sub": subjects,
            },
          },
        },
      ],
    }),
  ),
  description:
    "Assumed by GitHub Actions in auctionready/nag to deploy the Nag backend via Pulumi.",
});

new aws.iam.RolePolicyAttachment("nag-github-deploy-power", {
  role: role.name,
  policyArn: "arn:aws:iam::aws:policy/PowerUserAccess",
});

// PowerUserAccess excludes IAM; the deploy stack creates an IAM role for the
// Lambda, so we grant a narrow scope of IAM permissions here.
new aws.iam.RolePolicy("nag-github-deploy-iam", {
  role: role.id,
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:PassRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:TagRole",
          "iam:UntagRole",
        ],
        Resource: "arn:aws:iam::*:role/nag-api-lambda-*",
      },
      {
        Effect: "Allow",
        Action: ["iam:CreateServiceLinkedRole"],
        Resource: "*",
      },
    ],
  }),
});

export const oidcProviderArn = oidcProvider.arn;
export const deployRoleArn = role.arn;
export const deployRoleName = role.name;
export const subjectsGranted = subjects;
