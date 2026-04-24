import { stackConfig } from "./src/config";
import { createNetwork } from "./src/network";
import { createDatabase } from "./src/database";
import { createSecrets } from "./src/secrets";
import { createApi } from "./src/api";

const network = createNetwork();

const secrets = createSecrets({
  apiKey: stackConfig.apiKey,
});

const database = createDatabase({
  privateSubnetIds: network.privateSubnetIds,
  dbSgId: network.dbSgId,
  minAcu: stackConfig.dbMinAcu,
  maxAcu: stackConfig.dbMaxAcu,
});

const api = createApi({
  privateSubnetIds: network.privateSubnetIds,
  lambdaSgId: network.lambdaSgId,
  dbEndpoint: database.endpoint,
  dbName: database.databaseName,
  dbUsername: database.masterUsername,
  dbSecretArn: database.masterSecretArn,
  apiKeySecretArn: secrets.apiKeySecretArn,
  lambdaPackagePath: stackConfig.lambdaPackagePath,
  memoryMb: stackConfig.lambdaMemoryMb,
  logRetentionDays: stackConfig.logRetentionDays,
});

export const invokeUrl = api.invokeUrl;
export const functionName = api.functionName;
export const logGroupName = api.logGroupName;
export const dbEndpoint = database.endpoint;
export const apiKeySecretArn = secrets.apiKeySecretArn;
export const dbMasterSecretArn = database.masterSecretArn;
