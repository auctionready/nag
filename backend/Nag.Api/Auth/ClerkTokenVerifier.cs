using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Nag.Api.Auth;

public sealed class ClerkOptions
{
    /// <summary>
    /// Clerk Frontend API URL — e.g. <c>https://your-instance.clerk.accounts.dev</c>.
    /// Used as both the JWT issuer and the base for OIDC discovery
    /// (<c>/.well-known/openid-configuration</c>).
    /// </summary>
    public string Issuer { get; set; } = "";
}

public sealed record ClerkTokenVerificationResult(bool Ok, string? Subject, string? Error)
{
    public static ClerkTokenVerificationResult Success(string subject) => new(true, subject, null);

    public static ClerkTokenVerificationResult Failure(string error) => new(false, null, error);
}

public interface IClerkTokenVerifier
{
    Task<ClerkTokenVerificationResult> VerifyAsync(string token, CancellationToken ct);
}

/// <summary>
/// Validates Clerk-issued session JWTs against the JWKS published at the
/// configured issuer. Verifies signature, issuer, lifetime; extracts the
/// <c>sub</c> claim. Audience is intentionally not validated — Clerk
/// session tokens don't always carry an <c>aud</c>, and the issuer pin
/// already binds the token to our Clerk instance.
/// </summary>
public sealed class ClerkTokenVerifier : IClerkTokenVerifier
{
    private readonly string _issuer;
    private readonly IConfigurationManager<OpenIdConnectConfiguration> _configManager;
    private readonly JsonWebTokenHandler _handler = new();

    public ClerkTokenVerifier(
        IOptions<ClerkOptions> options,
        IConfigurationManager<OpenIdConnectConfiguration> configManager
    )
    {
        var issuer = options.Value.Issuer;
        if (string.IsNullOrWhiteSpace(issuer))
        {
            throw new InvalidOperationException(
                "Nag:ClerkIssuer is not configured. Set the Clerk Frontend API URL "
                    + "(e.g. https://your-instance.clerk.accounts.dev)."
            );
        }
        _issuer = issuer;
        _configManager = configManager;
    }

    public async Task<ClerkTokenVerificationResult> VerifyAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return ClerkTokenVerificationResult.Failure("token is empty");
        }

        OpenIdConnectConfiguration config;
        try
        {
            config = await _configManager.GetConfigurationAsync(ct);
        }
        catch (Exception ex)
        {
            return ClerkTokenVerificationResult.Failure(
                $"failed to fetch OIDC configuration: {ex.Message}"
            );
        }

        var validationParameters = new TokenValidationParameters
        {
            ValidIssuer = _issuer,
            ValidateIssuer = true,
            IssuerSigningKeys = config.SigningKeys,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidateAudience = false,
            ClockSkew = TimeSpan.FromMinutes(2),
        };

        var result = await _handler.ValidateTokenAsync(token, validationParameters);
        if (!result.IsValid)
        {
            return ClerkTokenVerificationResult.Failure(
                result.Exception?.Message ?? "invalid token"
            );
        }

        if (
            !result.Claims.TryGetValue("sub", out var subClaim)
            || subClaim is not string sub
            || string.IsNullOrEmpty(sub)
        )
        {
            return ClerkTokenVerificationResult.Failure("token has no sub claim");
        }

        return ClerkTokenVerificationResult.Success(sub);
    }
}
