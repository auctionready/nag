using Sentry;

namespace Nag.Api.Infrastructure;

public static class SentryScrubbing
{
    // Routes whose JSON bodies carry replayable secrets (Clerk JWTs in
    // `idpToken`, the admin pre-shared secret in `Secret`). Sentry's default
    // sanitizer strips `Authorization` headers but not arbitrary body fields,
    // so we drop the body wholesale rather than risk a future shape change
    // leaking a new field.
    private static readonly string[] SensitivePathPrefixes =
    [
        "/admin/",
        "/accounts/me/identity",
        "/accounts/me/devices",
        "/accounts/by-clerk-identity",
    ];

    public static SentryEvent ScrubSensitiveRequests(SentryEvent sentryEvent)
    {
        var url = sentryEvent.Request.Url;
        if (url is null)
            return sentryEvent;

        var path = ExtractPath(url);
        if (!IsSensitive(path))
            return sentryEvent;

        sentryEvent.Request.Data = "[scrubbed]";
        sentryEvent.Request.QueryString = null;
        return sentryEvent;
    }

    private static string ExtractPath(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
            return absolute.AbsolutePath;
        var queryIndex = url.IndexOf('?');
        return queryIndex < 0 ? url : url[..queryIndex];
    }

    private static bool IsSensitive(string path) =>
        SensitivePathPrefixes.Any(prefix =>
            path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
        );
}
