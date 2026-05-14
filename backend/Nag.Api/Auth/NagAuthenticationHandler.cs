using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Nag.Api.Auth;

/// <summary>
/// The single authentication scheme for the Nag API. Reads
/// <c>Authorization: Bearer &lt;token&gt;</c> and dispatches to one of
/// two validators based on the token shape:
/// <list type="bullet">
///   <item>two dots (<c>header.payload.signature</c>) → Clerk JWT</item>
///   <item>one dot (<c>payload.signature</c>) → device HMAC token</item>
/// </list>
/// </summary>
public sealed class NagAuthenticationHandler(
    IOptionsMonitor<NagAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IDeviceTokenValidator deviceTokens,
    IClerkTokenVerifier clerk,
    IDeviceAccountResolver resolver
) : AuthenticationHandler<NagAuthenticationOptions>(options, logger, encoder)
{
    private const string BearerPrefix = "Bearer ";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (
            string.IsNullOrEmpty(header)
            || !header.StartsWith(BearerPrefix, StringComparison.Ordinal)
        )
            return AuthenticateResult.NoResult();

        var token = header[BearerPrefix.Length..].Trim();
        if (string.IsNullOrEmpty(token))
            return AuthenticateResult.NoResult();

        return token.AsSpan().Count('.') switch
        {
            1 => await HandleDeviceToken(token, Context.RequestAborted),
            2 => await HandleClerkToken(token, Context.RequestAborted),
            _ => AuthenticateResult.Fail("token format not recognized"),
        };
    }

    private async Task<AuthenticateResult> HandleDeviceToken(string token, CancellationToken ct)
    {
        var result = deviceTokens.Validate(token);
        if (!result.Ok)
            return AuthenticateResult.Fail(result.FailureReason ?? "invalid device token");

        // Bind the still-valid HMAC to a live Account row. Without this an
        // out-of-band `DELETE /accounts/me` (or any other path that removes
        // the row) would leave the token authenticating against an orphan
        // tenant id — the dispatcher would happily append events under that
        // tenant, silently re-creating per-tenant state for a "deleted"
        // account.
        if (!await resolver.AccountExists(result.AccountId, ct))
            return AuthenticateResult.Fail("account is no longer active");

        var identity = new ClaimsIdentity(
            [
                new Claim(NagClaimTypes.AccountId, result.AccountId.ToString("D")),
                new Claim(NagClaimTypes.DeviceId, result.DeviceId.ToString("D")),
                new Claim(NagClaimTypes.AuthMethod, NagAuthMethods.Device),
            ],
            authenticationType: NagAuthenticationOptions.SchemeName,
            nameType: NagClaimTypes.DeviceId,
            roleType: ClaimTypes.Role
        );
        return Success(identity);
    }

    private async Task<AuthenticateResult> HandleClerkToken(string token, CancellationToken ct)
    {
        var verification = await clerk.VerifyAsync(token, ct);
        if (!verification.Ok || string.IsNullOrEmpty(verification.Subject))
            return AuthenticateResult.Fail(verification.Error ?? "invalid Clerk token");

        var sub = verification.Subject;
        var accountId = await resolver.AccountIdForSubject(sub, ct);
        if (accountId is null)
            return AuthenticateResult.Fail("no account is bound to this Clerk identity");

        var identity = new ClaimsIdentity(
            [
                new Claim(NagClaimTypes.Subject, sub),
                new Claim(NagClaimTypes.AccountId, accountId.Value.ToString("D")),
                new Claim(NagClaimTypes.AuthMethod, NagAuthMethods.Clerk),
            ],
            authenticationType: NagAuthenticationOptions.SchemeName,
            nameType: NagClaimTypes.Subject,
            roleType: ClaimTypes.Role
        );
        return Success(identity);
    }

    private static AuthenticateResult Success(ClaimsIdentity identity)
    {
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, NagAuthenticationOptions.SchemeName);
        return AuthenticateResult.Success(ticket);
    }
}
