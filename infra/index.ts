import * as pulumi from "@pulumi/pulumi";
import { stackConfig } from "./src/config";
import { createDatabase } from "./src/database";
import { createApi } from "./src/api";
import { createDomain } from "./src/domain";
import { applyMigrations } from "./src/migrations";

const database = createDatabase({
  apiKey: stackConfig.neonApiKey,
  orgId: stackConfig.neonOrgId,
  regionId: stackConfig.neonRegionId,
  pgVersion: stackConfig.neonPgVersion,
  projectName: stackConfig.neonProjectName,
  branchName: stackConfig.neonBranchName,
  databaseName: stackConfig.neonDatabaseName,
  roleName: stackConfig.neonRoleName,
  minCu: stackConfig.neonMinCu,
  maxCu: stackConfig.neonMaxCu,
  suspendTimeoutSeconds: stackConfig.neonSuspendTimeoutSeconds,
  existingProjectId: stackConfig.neonProjectId,
});

const api = createApi({
  databaseUrl: database.connectionUri,
  deviceTokenSecret: stackConfig.deviceTokenSecret,
  adminSecret: stackConfig.adminSecret,
  clerkIssuer: stackConfig.clerkIssuer,
  sentryDsn: stackConfig.sentryDsn,
  sentryEnvironment: stackConfig.sentryEnvironment,
  lambdaPackagePath: stackConfig.lambdaPackagePath,
  memoryMb: stackConfig.lambdaMemoryMb,
  logRetentionDays: stackConfig.logRetentionDays,
});

const domain =
  stackConfig.apiDomainName && stackConfig.hostedZoneName
    ? createDomain({
        apiId: api.apiId,
        stageName: api.stageName,
        domainName: stackConfig.apiDomainName,
        hostedZoneName: stackConfig.hostedZoneName,
      })
    : undefined;

applyMigrations({
  databaseUrl: database.connectionUri,
  lambdaSourceCodeHash: api.sourceCodeHash,
  dependsOn: [api.lambda],
});

export const invokeUrl = api.invokeUrl;
export const apiUrl: pulumi.Output<string> = domain
  ? domain.url
  : api.invokeUrl;
export const functionName = api.functionName;
export const logGroupName = api.logGroupName;
