namespace Nag.Core.Contracts;

/// <summary>
/// <c>Force</c> opts in to the "use this device's data" flow when the
/// verified Clerk identity is already bound to a different account. The
/// server unbinds it from the old account and binds it to the calling
/// device's account in one transaction. The old account keeps its rows
/// but loses its identity link (orphaned, recoverable manually). Default
/// false preserves the strict 409 behaviour for clients that didn't ask
/// to take over an existing identity.
/// </summary>
public sealed record UpgradeAccountRequest(Guid DeviceId, string IdpToken, bool Force = false);

public sealed record UpgradeAccountResponse(
    Guid AccountId,
    string IdpSubject,
    DateTimeOffset UpgradedAt,
    string DeviceToken
);

public sealed record UnbindAccountResponse(Guid AccountId);

public sealed record DeleteAccountResponse(Guid AccountId);
