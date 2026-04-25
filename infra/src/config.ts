import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("nag");

export const stackConfig = {
  // HMAC-SHA256 signing key for per-device bearer tokens. Rotate by
  // setting a new value and redeploying — every previously-issued
  // token becomes invalid (clients re-register on next 401). Generate
  // a fresh value with `openssl rand -base64 48`.
  deviceTokenSecret: cfg.requireSecret("deviceTokenSecret"),
  dbPassword: cfg.requireSecret("dbPassword"),
  dbMinAcu: cfg.getNumber("dbMinAcu") ?? 0,
  dbMaxAcu: cfg.getNumber("dbMaxAcu") ?? 2,
  dbAutoPauseSeconds: cfg.getNumber("dbAutoPauseSeconds") ?? 3000,
  lambdaMemoryMb: cfg.getNumber("lambdaMemoryMb") ?? 1536,
  lambdaPackagePath: cfg.get("lambdaPackagePath") ?? "./artifacts/nag-api.zip",
  logRetentionDays: cfg.getNumber("logRetentionDays") ?? 14,
  // EC2 instance type for the cost-minimized NAT instance. t4g.nano is
  // sufficient for the current Clerk-only egress workload (~few KB,
  // cached). Bump if outbound traffic ever grows.
  natInstanceType: cfg.get("natInstanceType") ?? "t4g.nano",
  apiDomainName: cfg.get("apiDomainName"),
  hostedZoneName: cfg.get("hostedZoneName"),
  // Clerk Frontend API URL — e.g. https://your-instance.clerk.accounts.dev.
  // Public (not secret), but set per-stack so dev / prod can point at
  // different Clerk instances. When unset the backend skips Clerk wiring
  // and /accounts/upgrade + /devices/pair return 503 / fail to resolve.
  clerkIssuer: cfg.get("clerkIssuer"),
};
