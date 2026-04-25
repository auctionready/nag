#if DEBUG
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Nag.Api.Auth;

namespace Nag.Api.OpenApi;

/// <summary>
/// DEBUG-only glue that lets Swagger UI authenticate without going through
/// the real /devices/register flow.
///
/// <para>
/// <c>GET /dev/token</c> mints an HMAC device token bound to a stable dev
/// account/device pair (overridable via <c>Nag:DeviceToken:DevAccountId</c>
/// / <c>:DevDeviceId</c>). The route is <c>ExcludeFromDescription</c> so it
/// doesn't leak into the OpenAPI spec used by the mobile API client.
/// </para>
///
/// <para>
/// <see cref="RequestInterceptorScript"/> is wired into Swagger UI via
/// <c>UseRequestInterceptor</c>. It fetches <c>/dev/token</c> on the first
/// outgoing request, caches the bearer on <c>window</c>, and stamps
/// <c>Authorization: Bearer …</c> onto every subsequent request. This is
/// more reliable than <c>preauthorizeApiKey</c>, which registers the auth
/// as <c>apiKey</c>-shaped and is then skipped by swagger-ui's HTTP-bearer
/// applier.
/// </para>
///
/// <para>
/// The script is intentionally:
/// (a) without <c>async</c>/<c>await</c> — swagger-ui's <c>parseFunction</c>
///     rebuilds it with <c>new Function(...)</c>, which is always synchronous;
///     <c>await</c> would be a SyntaxError. Returning a Promise is fine and
///     swagger-ui awaits it internally.
/// (b) on a single line — Swashbuckle wraps the serialized JSON in a JS
///     single-quoted string (<c>JSON.parse('…')</c>). Its serializer escapes
///     <c>&gt;</c>/<c>'</c>/<c>&amp;</c> as <c>\uXXXX</c> but encodes newlines
///     as the JSON 2-char escape <c>\n</c>. JS unescapes that to a real newline
///     before JSON.parse runs, and JSON forbids raw control chars inside string
///     literals — surfacing as "Bad control character in string literal in JSON
///     at position …".
/// </para>
/// </summary>
public static class SwaggerDevAuth
{
    public const string TokenPath = "/dev/token";

    private static readonly Guid DefaultAccountId = new("11111111-1111-1111-1111-111111111111");
    private static readonly Guid DefaultDeviceId = new("22222222-2222-2222-2222-222222222222");

    public sealed record DevTokenResponse(Guid AccountId, Guid DeviceId, string Token);

    public const string RequestInterceptorScript =
        "(req) => { if (req.url.endsWith('/dev/token')) return req; "
        + "const stamp = (t) => { if (t && !req.headers['Authorization']) req.headers['Authorization'] = 'Bearer ' + t; return req; }; "
        + "if (window.__nagDevToken) return stamp(window.__nagDevToken); "
        + "return fetch('/dev/token').then((r) => r.ok ? r.json() : null).then((d) => { "
        + "if (d) { window.__nagDevToken = d.token; console.log('[swagger-dev-auth] cached bearer for account', d.accountId); } "
        + "return stamp(window.__nagDevToken); "
        + "}).catch((err) => { console.warn('[swagger-dev-auth] interceptor failed:', err); return req; }); }";

    public static IEndpointRouteBuilder MapSwaggerDevAuth(this IEndpointRouteBuilder routes)
    {
        routes
            .MapGet(
                TokenPath,
                (IDeviceTokenIssuer tokens, IConfiguration config) =>
                {
                    var accountId =
                        ParseGuid(config["Nag:DeviceToken:DevAccountId"]) ?? DefaultAccountId;
                    var deviceId =
                        ParseGuid(config["Nag:DeviceToken:DevDeviceId"]) ?? DefaultDeviceId;
                    return Results.Ok(
                        new DevTokenResponse(accountId, deviceId, tokens.Issue(accountId, deviceId))
                    );
                }
            )
            .AllowAnonymous()
            .ExcludeFromDescription();

        return routes;
    }

    private static Guid? ParseGuid(string? value) => Guid.TryParse(value, out var g) ? g : null;
}
#endif
