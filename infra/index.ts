import { stackConfig } from "./src/config";
import { createNetwork } from "./src/network";
import { createDatabase } from "./src/database";
import { createApi } from "./src/api";

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
  apiKey: stackConfig.apiKey,
  lambdaPackagePath: stackConfig.lambdaPackagePath,
  memoryMb: stackConfig.lambdaMemoryMb,
  logRetentionDays: stackConfig.logRetentionDays,
});

export const invokeUrl = api.invokeUrl;
export const functionName = api.functionName;
export const logGroupName = api.logGroupName;
export const dbEndpoint = database.endpoint;
