#if DEBUG
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Nag.Api.Auth;

namespace Nag.Api.OpenApi;

/// <summary>
/// DEBUG-only glue that lets Swagger UI authenticate without going through
/// the real /devices/register flow:
/// <list type="bullet">
///   <item><c>GET /dev/token</c> mints an HMAC device token bound to a
///   stable dev account/device pair (overridable via
///   <c>Nag:DeviceToken:DevAccountId</c> / <c>:DevDeviceId</c>).</item>
///   <item><c>GET /swagger-dev-auth.js</c> is injected into Swagger UI
///   (<see cref="Microsoft.AspNetCore.Builder.SwaggerUIOptions.InjectJavascript"/>);
///   on load it fetches <c>/dev/token</c> and calls
///   <c>ui.preauthorizeApiKey("Bearer", …)</c>.</item>
/// </list>
/// Both routes are <c>.ExcludeFromDescription()</c> so they don't leak
/// into the generated OpenAPI spec used by the mobile API client.
/// </summary>
public static class SwaggerDevAuth
{
    public const string ScriptPath = "/swagger-dev-auth.js";
    public const string TokenPath = "/dev/token";

    private static readonly Guid DefaultAccountId = new("11111111-1111-1111-1111-111111111111");
    private static readonly Guid DefaultDeviceId = new("22222222-2222-2222-2222-222222222222");

    public sealed record DevTokenResponse(Guid AccountId, Guid DeviceId, string Token);

    private const string Script = """
        (function () {
          function attempt(retries) {
            if (!window.ui || typeof window.ui.preauthorizeApiKey !== 'function') {
              if (retries > 0) {
                setTimeout(function () { attempt(retries - 1); }, 50);
              } else {
                console.warn('[swagger-dev-auth] swagger UI never became ready');
              }
              return;
            }
            fetch('/dev/token')
              .then(function (r) {
                if (!r.ok) throw new Error('GET /dev/token -> ' + r.status);
                return r.json();
              })
              .then(function (data) {
                window.ui.preauthorizeApiKey('Bearer', data.token);
                console.log('[swagger-dev-auth] preauthorized as account', data.accountId);
              })
              .catch(function (err) {
                console.warn('[swagger-dev-auth] failed:', err);
              });
          }
          attempt(50);
        })();
        """;

    public static IEndpointRouteBuilder MapSwaggerDevAuth(this IEndpointRouteBuilder routes)
    {
        routes
            .MapGet(ScriptPath, () => Results.Content(Script, "application/javascript"))
            .AllowAnonymous()
            .ExcludeFromDescription();

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
