using System.Text.Json;
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;

namespace Nag.Api.Infrastructure;

/// <summary>
/// When running in Lambda, fetches the RDS-managed master secret and the API
/// key secret from AWS Secrets Manager and pushes them into
/// <see cref="IConfiguration"/>. Opt-in: only runs when <c>DB_SECRET_ARN</c>
/// is set, so local <c>dotnet run</c> and tests are unaffected.
/// </summary>
public static class LambdaSecrets
{
    public static async Task HydrateFromSecretsManagerAsync(ConfigurationManager configuration)
    {
        var dbSecretArn = Environment.GetEnvironmentVariable("DB_SECRET_ARN");
        if (string.IsNullOrWhiteSpace(dbSecretArn))
        {
            return;
        }

        using var client = new AmazonSecretsManagerClient();

        var dbSecret = await client.GetSecretValueAsync(
            new GetSecretValueRequest { SecretId = dbSecretArn }
        );

        using var json = JsonDocument.Parse(dbSecret.SecretString);
        var password =
            json.RootElement.GetProperty("password").GetString()
            ?? throw new InvalidOperationException(
                "RDS master secret does not contain a 'password' field."
            );

        var host =
            Environment.GetEnvironmentVariable("DB_HOST")
            ?? throw new InvalidOperationException("DB_HOST is not set.");
        var database = Environment.GetEnvironmentVariable("DB_NAME") ?? "nag";
        var username = Environment.GetEnvironmentVariable("DB_USERNAME") ?? "nag";

        configuration["ConnectionStrings:Nag"] =
            $"Host={host};Port=5432;Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";

        var apiKeyArn = Environment.GetEnvironmentVariable("API_KEY_SECRET_ARN");
        if (!string.IsNullOrWhiteSpace(apiKeyArn))
        {
            var apiKeySecret = await client.GetSecretValueAsync(
                new GetSecretValueRequest { SecretId = apiKeyArn }
            );
            configuration["Nag:ApiKey"] = apiKeySecret.SecretString;
        }
    }
}
