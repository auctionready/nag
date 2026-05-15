namespace Nag.Core.Contracts;

public sealed record RegisterDeviceRequest(Guid DeviceId, string? Label);

public sealed record RegisterDeviceResponse(
    Guid AccountId,
    Guid DeviceId,
    DateTimeOffset RegisteredAt,
    string DeviceToken
);

public sealed record PairDeviceRequest(Guid DeviceId, string IdpToken, string? Label);

public sealed record PairDeviceResponse(
    Guid AccountId,
    Guid DeviceId,
    DateTimeOffset RegisteredAt,
    string DeviceToken
);

public sealed record GetDeviceResponse(
    Guid AccountId,
    Guid DeviceId,
    string? Label,
    DateTimeOffset RegisteredAt
);
