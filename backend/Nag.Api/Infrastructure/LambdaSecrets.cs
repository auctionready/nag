namespace Nag.Api.Infrastructure;

/// <summary>
/// In Lambda, assembles the DB connection string and device-token secret
/// from the function's environment variables. Opt-in: only runs when
/// <c>DATABASE_URL</c> is set, so local <c>dotnet run</c> and tests fall
/// back to <c>appsettings</c>.
/// </summary>
public static class LambdaSecrets
{
    public static void HydrateFromEnvironment(ConfigurationManager configuration)
    {
        var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
        if (!string.IsNullOrWhiteSpace(databaseUrl))
        {
            configuration["ConnectionStrings:Nag"] = NpgsqlConnectionStringFromUri(databaseUrl);
        }

        var deviceTokenSecret = Environment.GetEnvironmentVariable("DEVICE_TOKEN_SECRET");
        if (!string.IsNullOrWhiteSpace(deviceTokenSecret))
        {
            configuration["Nag:DeviceToken:Secret"] = deviceTokenSecret;
        }

        // Sentry: forward the DSN (and optional release/environment) into
        // IConfiguration so `WebHost.UseSentry` picks them up via the
        // `Sentry:*` config binding. Leaving SENTRY_DSN unset disables the
        // SDK at runtime — useful for the `db-apply` invocation, which
        // shouldn't ship its lifecycle events to Sentry.
        var sentryDsn = Environment.GetEnvironmentVariable("SENTRY_DSN");
        if (!string.IsNullOrWhiteSpace(sentryDsn))
        {
            configuration["Sentry:Dsn"] = sentryDsn;
        }

        var sentryRelease = Environment.GetEnvironmentVariable("SENTRY_RELEASE");
        if (!string.IsNullOrWhiteSpace(sentryRelease))
        {
            configuration["Sentry:Release"] = sentryRelease;
        }

        var sentryEnvironment = Environment.GetEnvironmentVariable("SENTRY_ENVIRONMENT");
        if (!string.IsNullOrWhiteSpace(sentryEnvironment))
        {
            configuration["Sentry:Environment"] = sentryEnvironment;
        }
    }

    // Neon's `connection_uri` returns a `postgres://user:pass@host/db?sslmode=require`
    // URI; Npgsql's connection string is key=value pairs, so translate. SSL is
    // forced on — Neon's public endpoint is TLS-only.
    private static string NpgsqlConnectionStringFromUri(string uriString)
    {
        var uri = new Uri(uriString);
        var userInfo = uri.UserInfo.Split(':', 2);
        var username = Uri.UnescapeDataString(userInfo[0]);
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
        var port = uri.Port > 0 ? uri.Port : 5432;

        return $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    }
}
