import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface ApiArgs {
  privateSubnetIds: pulumi.Output<string[]>;
  lambdaSgId: pulumi.Output<string>;
  dbEndpoint: pulumi.Output<string>;
  dbName: pulumi.Output<string>;
  dbUsername: pulumi.Output<string>;
  dbSecretArn: pulumi.Output<string>;
  apiKeySecretArn: pulumi.Output<string>;
  lambdaPackagePath: string;
  memoryMb: number;
  logRetentionDays: number;
}

export interface Api {
  invokeUrl: pulumi.Output<string>;
  logGroupName: pulumi.Output<string>;
  functionName: pulumi.Output<string>;
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

  new aws.iam.RolePolicyAttachment("nag-api-vpc", {
    role: role.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
  });

  new aws.iam.RolePolicy("nag-api-secrets", {
    role: role.id,
    policy: pulumi
      .all([args.dbSecretArn, args.apiKeySecretArn])
      .apply(([dbArn, apiArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["secretsmanager:GetSecretValue"],
              Resource: [dbArn, apiArn],
            },
          ],
        }),
      ),
  });

  const fn = new aws.lambda.Function("nag-api", {
    name: "nag-api",
    runtime: "dotnet10",
    architectures: ["arm64"],
    handler: "Nag.Api",
    role: role.arn,
    memorySize: args.memoryMb,
    timeout: 30,
    code: new pulumi.asset.FileArchive(args.lambdaPackagePath),
    vpcConfig: {
      subnetIds: args.privateSubnetIds,
      securityGroupIds: [args.lambdaSgId],
    },
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
        DB_SECRET_ARN: args.dbSecretArn,
        API_KEY_SECRET_ARN: args.apiKeySecretArn,
        Nag__SchemaName: "public",
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
    invokeUrl: stage.invokeUrl,
    logGroupName: logGroup.name,
    functionName: fn.name,
  };
};
