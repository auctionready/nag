import * as pulumi from "@pulumi/pulumi";
import { stackConfig } from "./src/config";
import { createNetwork } from "./src/network";
import { createDatabase } from "./src/database";
import { createApi } from "./src/api";
import { createDomain } from "./src/domain";

const network = createNetwork();

const database = createDatabase({
  privateSubnetIds: network.privateSubnetIds,
  dbSgId: network.dbSgId,
  masterPassword: stackConfig.dbPassword,
  minAcu: stackConfig.dbMinAcu,
  maxAcu: stackConfig.dbMaxAcu,
  autoPauseSeconds: stackConfig.dbAutoPauseSeconds,
});

const api = createApi({
  privateSubnetIds: network.privateSubnetIds,
  lambdaSgId: network.lambdaSgId,
  dbEndpoint: database.endpoint,
  dbName: database.databaseName,
  dbUsername: database.masterUsername,
  dbPassword: stackConfig.dbPassword,
  deviceTokenSecret: stackConfig.deviceTokenSecret,
  clerkIssuer: stackConfig.clerkIssuer,
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

export const invokeUrl = api.invokeUrl;
export const apiUrl: pulumi.Output<string> = domain
  ? domain.url
  : api.invokeUrl;
export const functionName = api.functionName;
export const logGroupName = api.logGroupName;
export const dbEndpoint = database.endpoint;
