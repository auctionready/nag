import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("nag");

export const stackConfig = {
  apiKey: cfg.requireSecret("apiKey"),
  dbPassword: cfg.requireSecret("dbPassword"),
  dbMinAcu: cfg.getNumber("dbMinAcu") ?? 0,
  dbMaxAcu: cfg.getNumber("dbMaxAcu") ?? 2,
  dbAutoPauseSeconds: cfg.getNumber("dbAutoPauseSeconds") ?? 3000,
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
};
