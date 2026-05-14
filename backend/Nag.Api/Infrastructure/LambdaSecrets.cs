using Npgsql;

namespace Nag.Api.Infrastructure;

/// <summary>
/// In Lambda, assembles the DB connection string and device-token secret
/// from the function's environment variables. When running in Lambda
/// (<c>AWS_LAMBDA_FUNCTION_NAME</c> set), required env vars are enforced
/// at startup so a misconfigured deployment fails fast — instead of
/// later, deep inside DI resolution, with a misleading error.
/// </summary>
public static class LambdaSecrets
{
    public static void HydrateFromEnvironment(ConfigurationManager configuration)
    {
        var inLambda = !string.IsNullOrEmpty(
            Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME")
        );

        var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
        if (inLambda && string.IsNullOrWhiteSpace(databaseUrl))
        {
            throw new InvalidOperationException(
                "DATABASE_URL is not set. The Lambda requires it to build the Postgres connection string."
            );
        }
        if (!string.IsNullOrWhiteSpace(databaseUrl))
        {
            configuration["ConnectionStrings:Nag"] = NpgsqlConnectionStringFromUri(databaseUrl);
        }

        var deviceTokenSecret = Environment.GetEnvironmentVariable("DEVICE_TOKEN_SECRET");
        if (inLambda && string.IsNullOrWhiteSpace(deviceTokenSecret))
        {
            throw new InvalidOperationException(
                "DEVICE_TOKEN_SECRET is not set. The Lambda requires it to sign device tokens."
            );
        }
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

    // Neon's `connection_uri` returns a `postgres://user:pass@host/db?sslmode=...`
    // URI; Npgsql's connection string is key=value pairs, so translate.
    //
    // SslMode defaults to VerifyFull when the URI doesn't specify one — Neon's
    // endpoint is signed by ISRG Root X1 (Let's Encrypt), which Amazon Linux's
    // CA bundle trusts out of the box, so full hostname + chain verification
    // works without bundling a private cert. Whatever sslmode the URI does
    // specify is preserved, so the deployment can adjust it via `DATABASE_URL`
    // alone (e.g. a non-Neon target with a private CA).
    private static string NpgsqlConnectionStringFromUri(string uriString)
    {
        var uri = new Uri(uriString);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
            SslMode = SslMode.VerifyFull,
        };

        foreach (var (key, value) in ParseQuery(uri.Query))
        {
            switch (key.ToLowerInvariant())
            {
                case "sslmode":
                    builder.SslMode = ParseSslMode(value);
                    break;
                case "channel_binding":
                    builder.ChannelBinding = ParseChannelBinding(value);
                    break;
                case "options":
                    builder.Options = value;
                    break;
            }
        }

        return builder.ToString();
    }

    private static IEnumerable<(string Key, string Value)> ParseQuery(string query)
    {
        if (string.IsNullOrEmpty(query))
            yield break;
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = pair.IndexOf('=');
            if (eq < 0)
                yield return (Uri.UnescapeDataString(pair), "");
            else
                yield return (
                    Uri.UnescapeDataString(pair[..eq]),
                    Uri.UnescapeDataString(pair[(eq + 1)..])
                );
        }
    }

    private static SslMode ParseSslMode(string value) =>
        value.ToLowerInvariant() switch
        {
            "disable" => SslMode.Disable,
            "allow" => SslMode.Allow,
            "prefer" => SslMode.Prefer,
            "require" => SslMode.Require,
            "verify-ca" => SslMode.VerifyCA,
            "verify-full" => SslMode.VerifyFull,
            _ => throw new InvalidOperationException(
                $"DATABASE_URL has unrecognized sslmode '{value}'."
            ),
        };

    private static ChannelBinding ParseChannelBinding(string value) =>
        value.ToLowerInvariant() switch
        {
            "disable" => ChannelBinding.Disable,
            "prefer" => ChannelBinding.Prefer,
            "require" => ChannelBinding.Require,
            _ => throw new InvalidOperationException(
                $"DATABASE_URL has unrecognized channel_binding '{value}'."
            ),
        };
}
