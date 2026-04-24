import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("nag");

export const stackConfig = {
  apiKey: cfg.requireSecret("apiKey"),
  dbMinAcu: cfg.getNumber("dbMinAcu") ?? 0.5,
  dbMaxAcu: cfg.getNumber("dbMaxAcu") ?? 2,
  lambdaMemoryMb: cfg.getNumber("lambdaMemoryMb") ?? 1536,
  lambdaPackagePath: cfg.get("lambdaPackagePath") ?? "./artifacts/nag-api.zip",
  logRetentionDays: cfg.getNumber("logRetentionDays") ?? 14,
};
