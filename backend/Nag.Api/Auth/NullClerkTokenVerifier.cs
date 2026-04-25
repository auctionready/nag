namespace Nag.Api.Auth;

/// <summary>
/// Stand-in <see cref="IClerkTokenVerifier"/> registered when
/// <c>Nag:ClerkIssuer</c> is unset (e.g. mobile-only deployments). Always
/// fails verification so the auth handler's Clerk branch returns 401 for
/// any JWT-shaped bearer rather than crashing on a missing dependency.
/// </summary>
public sealed class NullClerkTokenVerifier : IClerkTokenVerifier
{
    public Task<ClerkTokenVerificationResult> VerifyAsync(string token, CancellationToken ct) =>
        Task.FromResult(ClerkTokenVerificationResult.Failure("Clerk is not configured"));
}
