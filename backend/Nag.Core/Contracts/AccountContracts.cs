namespace Nag.Core.Contracts;

public sealed record UpgradeAccountRequest(Guid DeviceId, string IdpToken);

public sealed record UpgradeAccountResponse(
    Guid AccountId,
    string IdpSubject,
    DateTimeOffset UpgradedAt
);
