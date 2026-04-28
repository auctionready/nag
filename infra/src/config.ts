import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("nag");

export const stackConfig = {
  // HMAC-SHA256 signing key for per-device bearer tokens. Rotate by
  // setting a new value and redeploying — every previously-issued
  // token becomes invalid (clients re-register on next 401). Generate
  // a fresh value with `openssl rand -base64 48`.
  deviceTokenSecret: cfg.requireSecret("deviceTokenSecret"),
  // Neon API key used by the `pulumi-neon` provider to manage the
  // project / branch / role / database. Generate via the Neon Console
  // → Account Settings → API Keys.
  neonApiKey: cfg.requireSecret("neonApiKey"),
  // Neon organization ID. Find it in the Neon Console → Settings → General
  // (or via `GET https://console.neon.tech/api/v2/users/me/organizations`).
  // Required since Neon's 2024 multi-org rollout — project creation fails
  // without it.
  neonOrgId: cfg.require("neonOrgId"),
  neonRegionId: cfg.get("neonRegionId") ?? "aws-ap-southeast-2",
  neonPgVersion: cfg.getNumber("neonPgVersion") ?? 17,
  neonProjectName: cfg.get("neonProjectName") ?? "nag",
  neonBranchName: cfg.get("neonBranchName") ?? "main",
  neonDatabaseName: cfg.get("neonDatabaseName") ?? "nag",
  neonRoleName: cfg.get("neonRoleName") ?? "nag",
  // Compute units (CU): 1 CU ≈ 1 vCPU + 4 GB RAM. Default 0.25 / 1 keeps
  // idle cost near zero while allowing small bursts.
  neonMinCu: cfg.getNumber("neonMinCu") ?? 0.25,
  neonMaxCu: cfg.getNumber("neonMaxCu") ?? 1,
  // Idle seconds before the compute scales to zero. 0 = use Neon's
  // account default (5 min on Free, configurable on paid tiers).
  neonSuspendTimeoutSeconds: cfg.getNumber("neonSuspendTimeoutSeconds") ?? 0,
  lambdaMemoryMb: cfg.getNumber("lambdaMemoryMb") ?? 1536,
  lambdaPackagePath: cfg.get("lambdaPackagePath") ?? "./artifacts/nag-api.zip",
  logRetentionDays: cfg.getNumber("logRetentionDays") ?? 14,
  apiDomainName: cfg.get("apiDomainName"),
  hostedZoneName: cfg.get("hostedZoneName"),
  // Clerk Frontend API URL — e.g. https://your-instance.clerk.accounts.dev.
  // Public (not secret), but set per-stack so dev / prod can point at
  // different Clerk instances. When unset the backend skips Clerk wiring
  // and /accounts/upgrade + /devices/pair return 503 / fail to resolve.
  clerkIssuer: cfg.get("clerkIssuer"),
  // Sentry DSN for the backend project. Set with
  // `pulumi config set --secret nag:sentryDsn https://...@oXXX.ingest.sentry.io/YYY`.
  // When unset, the Lambda boots without Sentry — useful for ephemeral
  // preview stacks that shouldn't pollute the prod project.
  sentryDsn: cfg.getSecret("sentryDsn"),
  // Tag every event/transaction with this environment name (defaults to
  // the stack name, so `prod`/`dev`/`pr-123` map cleanly to Sentry's
  // environment filter).
  sentryEnvironment: cfg.get("sentryEnvironment") ?? pulumi.getStack(),
};
