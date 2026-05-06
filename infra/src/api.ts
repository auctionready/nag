import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as crypto from "crypto";
import * as fs from "fs";

export interface ApiArgs {
  dbEndpoint: pulumi.Output<string>;
  dbName: pulumi.Output<string>;
  dbUsername: pulumi.Output<string>;
  dbPassword: pulumi.Output<string>;
  deviceTokenSecret: pulumi.Output<string>;
  adminSecret?: pulumi.Output<string>;
  clerkIssuer?: string;
  sentryDsn?: pulumi.Output<string>;
  sentryEnvironment?: string;
  lambdaPackagePath: string;
  memoryMb: number;
  logRetentionDays: number;
}

export interface Api {
  apiId: pulumi.Output<string>;
  stageName: pulumi.Output<string>;
  invokeUrl: pulumi.Output<string>;
  logGroupName: pulumi.Output<string>;
  functionName: pulumi.Output<string>;
  lambda: aws.lambda.Function;
  // Base64-encoded SHA256 of the zip we uploaded. We compute it locally
  // (rather than relying on the AWS provider's `sourceCodeHash` output,
  // which is empty when not supplied as input) so downstream resources
  // — like the db-apply Command — can use it as a "code changed" trigger.
  sourceCodeHash: string;
}

export const createApi = (args: ApiArgs): Api => {
  const logGroup = new aws.cloudwatch.LogGroup("nag-api", {
    name: "/aws/lambda/nag-api",
    retentionInDays: args.logRetentionDays,
  });

  const role = new aws.iam.Role("nag-api-lambda", {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
  });

  new aws.iam.RolePolicyAttachment("nag-api-basic", {
    role: role.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });

  const sourceCodeHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(args.lambdaPackagePath))
    .digest("base64");

  const fn = new aws.lambda.Function("nag-api", {
    name: "nag-api",
    runtime: "dotnet10",
    architectures: ["arm64"],
    handler: "Nag.Api",
    role: role.arn,
    memorySize: args.memoryMb,
    timeout: 30,
    code: new pulumi.asset.FileArchive(args.lambdaPackagePath),
    sourceCodeHash,
    loggingConfig: {
      logFormat: "Text",
      logGroup: logGroup.name,
    },
    environment: {
      variables: {
        ASPNETCORE_ENVIRONMENT: "Production",
        DB_HOST: args.dbEndpoint,
        DB_NAME: args.dbName,
        DB_USERNAME: args.dbUsername,
        DB_PASSWORD: args.dbPassword,
        DEVICE_TOKEN_SECRET: args.deviceTokenSecret,
        Nag__SchemaName: "public",
        // Only set when configured — Program.cs registers the Clerk
        // verifier conditionally on Nag:ClerkIssuer being present.
        ...(args.clerkIssuer ? { Nag__ClerkIssuer: args.clerkIssuer } : {}),
        // Optional admin secret for /admin/rebuild-projections. When
        // unset, the endpoint refuses every request with 501.
        ...(args.adminSecret ? { Nag__AdminSecret: args.adminSecret } : {}),
        // Sentry: when DSN is unset, LambdaSecrets leaves Sentry:Dsn
        // empty and the SDK initializes in disabled mode (no network).
        ...(args.sentryDsn ? { SENTRY_DSN: args.sentryDsn } : {}),
        ...(args.sentryEnvironment
          ? { SENTRY_ENVIRONMENT: args.sentryEnvironment }
          : {}),
        SENTRY_RELEASE: sourceCodeHash,
      },
    },
  });

  const api = new aws.apigatewayv2.Api("nag", {
    name: "nag",
    protocolType: "HTTP",
  });

  const integration = new aws.apigatewayv2.Integration("nag-lambda", {
    apiId: api.id,
    integrationType: "AWS_PROXY",
    integrationUri: fn.invokeArn,
    payloadFormatVersion: "2.0",
  });

  new aws.apigatewayv2.Route("nag-default", {
    apiId: api.id,
    routeKey: "$default",
    target: pulumi.interpolate`integrations/${integration.id}`,
  });

  const stage = new aws.apigatewayv2.Stage("nag-default", {
    apiId: api.id,
    name: "$default",
    autoDeploy: true,
    accessLogSettings: {
      destinationArn: logGroup.arn,
      format: JSON.stringify({
        requestId: "$context.requestId",
        ip: "$context.identity.sourceIp",
        requestTime: "$context.requestTime",
        httpMethod: "$context.httpMethod",
        routeKey: "$context.routeKey",
        status: "$context.status",
        protocol: "$context.protocol",
        responseLength: "$context.responseLength",
        integrationError: "$context.integrationErrorMessage",
      }),
    },
  });

  new aws.lambda.Permission("nag-apigw-invoke", {
    action: "lambda:InvokeFunction",
    function: fn.name,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  });

  return {
    apiId: api.id,
    stageName: stage.name,
    invokeUrl: stage.invokeUrl,
    logGroupName: logGroup.name,
    functionName: fn.name,
    lambda: fn,
    sourceCodeHash,
  };
};
