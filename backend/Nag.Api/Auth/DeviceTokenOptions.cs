namespace Nag.Api.Auth;

public sealed class DeviceTokenOptions
{
    /// <summary>
    /// HMAC-SHA256 signing key. Set via <c>Nag:DeviceToken:Secret</c> in
    /// configuration, hydrated from the <c>DEVICE_TOKEN_SECRET</c>
    /// environment variable in Lambda. Rotating this value invalidates
    /// every previously-issued device token.
    /// </summary>
    public string Secret { get; set; } = "";

    /// <summary>
    /// How long a freshly-issued device token stays valid. Defaults to
    /// 365 days — long enough that mobile clients don't churn through
    /// a re-auth treadmill, short enough that a leaked secret-rotation
    /// recovers within a year even without explicit revocation.
    /// </summary>
    public TimeSpan Lifetime { get; set; } = TimeSpan.FromDays(365);
}
