namespace Nag.Core.Contracts;

public sealed record RegisterDeviceRequest(Guid DeviceId, string? Label);

public sealed record RegisterDeviceResponse(
    Guid AccountId,
    Guid DeviceId,
    DateTimeOffset RegisteredAt
);
