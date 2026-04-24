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
};
