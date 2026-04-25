namespace Nag.Api.Infrastructure;

/// <summary>
/// In Lambda, assembles the DB connection string and device-token secret
/// from the function's environment variables. Opt-in: only runs when
/// <c>DB_PASSWORD</c> is set, so local <c>dotnet run</c> and tests fall
/// back to <c>appsettings</c>.
/// </summary>
public static class LambdaSecrets
{
    public static void HydrateFromEnvironment(ConfigurationManager configuration)
    {
        var password = Environment.GetEnvironmentVariable("DB_PASSWORD");
        if (string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var host =
            Environment.GetEnvironmentVariable("DB_HOST")
            ?? throw new InvalidOperationException("DB_HOST is not set.");
        var database = Environment.GetEnvironmentVariable("DB_NAME") ?? "nag";
        var username = Environment.GetEnvironmentVariable("DB_USERNAME") ?? "nag";

        configuration["ConnectionStrings:Nag"] =
            $"Host={host};Port=5432;Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";

        var deviceTokenSecret = Environment.GetEnvironmentVariable("DEVICE_TOKEN_SECRET");
        if (!string.IsNullOrWhiteSpace(deviceTokenSecret))
        {
            configuration["Nag:DeviceToken:Secret"] = deviceTokenSecret;
        }
    }
}
