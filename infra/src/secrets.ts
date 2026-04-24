import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface SecretsArgs {
  apiKey: pulumi.Output<string>;
}

export interface Secrets {
  apiKeySecretArn: pulumi.Output<string>;
}

export const createSecrets = (args: SecretsArgs): Secrets => {
  const apiKey = new aws.secretsmanager.Secret("nag-api-key", {
    description: "Bearer API key for the Nag backend",
  });

  new aws.secretsmanager.SecretVersion("nag-api-key", {
    secretId: apiKey.id,
    secretString: args.apiKey,
  });

  return {
    apiKeySecretArn: apiKey.arn,
  };
};
