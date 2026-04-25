namespace Nag.Api.Auth;

public sealed record DeviceTokenValidationResult(
    bool Ok,
    Guid AccountId,
    Guid DeviceId,
    string? FailureReason
)
{
    public static DeviceTokenValidationResult Success(Guid accountId, Guid deviceId) =>
        new(true, accountId, deviceId, null);

    public static DeviceTokenValidationResult Failure(string reason) =>
        new(false, Guid.Empty, Guid.Empty, reason);
}

public interface IDeviceTokenValidator
{
    DeviceTokenValidationResult Validate(string token);
}
