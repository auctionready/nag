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
/// </summary>
public static class SwaggerDevAuth
{
    public const string TokenPath = "/dev/token";

    private static readonly Guid DefaultAccountId = new("11111111-1111-1111-1111-111111111111");
    private static readonly Guid DefaultDeviceId = new("22222222-2222-2222-2222-222222222222");

    public sealed record DevTokenResponse(Guid AccountId, Guid DeviceId, string Token);

    public const string RequestInterceptorScript = """
        async (req) => {
          try {
            if (!req.url.endsWith('/dev/token') && !window.__nagDevToken) {
              const r = await fetch('/dev/token');
              if (r.ok) {
                const data = await r.json();
                window.__nagDevToken = data.token;
                console.log('[swagger-dev-auth] cached bearer for account', data.accountId);
              }
            }
            if (window.__nagDevToken && !req.headers['Authorization']) {
              req.headers['Authorization'] = 'Bearer ' + window.__nagDevToken;
            }
          } catch (err) {
            console.warn('[swagger-dev-auth] interceptor failed:', err);
          }
          return req;
        }
        """;

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
