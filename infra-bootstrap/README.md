# Nag bootstrap (one-time)

Creates the GitHub OIDC identity provider and the `nag-github-deploy` IAM role used by `.github/workflows/deploy-backend.yml`. Run **once** by a human with local AWS admin credentials. The main `infra/` stack does **not** need to recreate these.

State backend: Pulumi Cloud. Region: `ap-southeast-2`.

## Prerequisites

- AWS CLI configured with admin credentials in `ap-southeast-2`.
- Pulumi CLI, Node 24, npm.
- `pulumi login` (Pulumi Cloud).

## Apply

```bash
cd infra-bootstrap
npm ci
pulumi stack init prod
pulumi up
```

Take the outputs and configure the repo on GitHub:

```bash
# GitHub → repo → Settings → Secrets and variables → Actions
#   Variable: AWS_DEPLOY_ROLE_ARN = <deployRoleArn output>
#   Secret:   PULUMI_ACCESS_TOKEN = <pulumi cloud personal token>
```

## Trust policy

The role trusts only the GitHub subjects listed in stack config:

- `allowedRefs` — full refs (e.g. `refs/heads/main`)
- `allowedEnvironments` — GitHub Actions environments (e.g. `prod`)

Edit `Pulumi.prod.yaml` and `pulumi up` to change the allow-list. The initial value includes the feature branch `claude/aws-pulumi-deployment-LETFa` so the first deploy can be tested; remove it once `main` is green.

## Permissions

The role has `PowerUserAccess` (no IAM by default) plus a narrow inline policy allowing:

- Create/update/delete/pass of IAM roles whose name matches `nag-api-lambda-*` (the role the deploy stack creates for the Lambda).
- `iam:CreateServiceLinkedRole` for services that need it (e.g. RDS).

Tighten this further once the resource shape settles.
