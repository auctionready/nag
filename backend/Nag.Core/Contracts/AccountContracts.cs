namespace Nag.Core.Contracts;

public sealed record SetAccountIdentityRequest(string IdpToken);

/// <summary>
/// Releases the account-to-Clerk-identity binding owned by whatever
/// account currently holds the verified <c>sub</c>. The caller proves
/// ownership of the identity by sending a valid Clerk JWT in the body;
/// this is the explicit "use this device's data" take-over step the
/// client runs before re-attempting <c>POST /accounts/me/identity</c>.
/// </summary>
public sealed record ReleaseAccountIdentityRequest(string IdpToken);

public sealed record AccountIdentity(string IdpSubject, DateTimeOffset UpgradedAt);
