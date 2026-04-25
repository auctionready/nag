namespace Nag.Api.Auth;

public interface IDeviceTokenIssuer
{
    /// <summary>
    /// Mints an HMAC-signed bearer token that authenticates the given
    /// device against the given account. The returned string goes
    /// directly into <c>Authorization: Bearer &lt;token&gt;</c>.
    /// </summary>
    string Issue(Guid accountId, Guid deviceId, DateTimeOffset? expiresAt = null);
}
