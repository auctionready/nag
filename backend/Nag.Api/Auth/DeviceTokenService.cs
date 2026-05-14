using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace Nag.Api.Auth;

/// <summary>
/// HMAC-SHA256-signed stateless device tokens. Wire format:
/// <code>base64url(payload) "." base64url(hmac)</code> where
/// <c>payload = deviceId(16 BE) || accountId(16 BE) || expiryUnix(8 BE)</c>
/// and <c>hmac = HMACSHA256(secret, payload)</c>.
/// </summary>
public sealed class DeviceTokenService(IOptions<DeviceTokenOptions> options, TimeProvider clock)
    : IDeviceTokenIssuer,
        IDeviceTokenValidator
{
    private const int PayloadLength = 16 + 16 + 8;
    private const int MacLength = 32;

    private readonly byte[] _key = Encoding.UTF8.GetBytes(
        !string.IsNullOrWhiteSpace(options.Value.Secret)
            ? options.Value.Secret
            : throw new InvalidOperationException(
                "Nag:DeviceToken:Secret is not configured. Set the DEVICE_TOKEN_SECRET "
                    + "environment variable (or Nag__DeviceToken__Secret)."
            )
    );
    private readonly TimeSpan _lifetime = options.Value.Lifetime;

    public string Issue(Guid accountId, Guid deviceId, DateTimeOffset? expiresAt = null)
    {
        var expiry = expiresAt ?? clock.GetUtcNow().Add(_lifetime);

        var payload = new byte[PayloadLength];
        WriteGuidBigEndian(deviceId, payload.AsSpan(0, 16));
        WriteGuidBigEndian(accountId, payload.AsSpan(16, 16));
        BinaryPrimitives.WriteInt64BigEndian(payload.AsSpan(32, 8), expiry.ToUnixTimeSeconds());

        var mac = HMACSHA256.HashData(_key, payload);

        return $"{Base64Url.Encode(payload)}.{Base64Url.Encode(mac)}";
    }

    public DeviceTokenValidationResult Validate(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return DeviceTokenValidationResult.Failure("token is empty");

        var dot = token.IndexOf('.');
        if (dot <= 0 || dot >= token.Length - 1 || token.IndexOf('.', dot + 1) >= 0)
            return DeviceTokenValidationResult.Failure("token is malformed");

        byte[] payload,
            providedMac;
        try
        {
            payload = Base64Url.Decode(token.AsSpan(0, dot));
            providedMac = Base64Url.Decode(token.AsSpan(dot + 1));
        }
        catch (FormatException)
        {
            return DeviceTokenValidationResult.Failure("token is not valid base64url");
        }

        if (payload.Length != PayloadLength || providedMac.Length != MacLength)
            return DeviceTokenValidationResult.Failure("token has wrong length");

        var expectedMac = HMACSHA256.HashData(_key, payload);
        if (!CryptographicOperations.FixedTimeEquals(expectedMac, providedMac))
            return DeviceTokenValidationResult.Failure("token signature is invalid");

        var deviceId = ReadGuidBigEndian(payload.AsSpan(0, 16));
        var accountId = ReadGuidBigEndian(payload.AsSpan(16, 16));
        var expiryUnix = BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(32, 8));
        var expiry = DateTimeOffset.FromUnixTimeSeconds(expiryUnix);

        if (expiry <= clock.GetUtcNow())
            return DeviceTokenValidationResult.Failure("token is expired");

        return DeviceTokenValidationResult.Success(accountId, deviceId);
    }

    private static void WriteGuidBigEndian(Guid g, Span<byte> dest)
    {
        // Guid.TryWriteBytes writes little-endian on the GUID's first three
        // fields by default; we want a stable big-endian wire layout so the
        // token is portable across platforms.
        Span<byte> tmp = stackalloc byte[16];
        g.TryWriteBytes(tmp, bigEndian: true, out _);
        tmp.CopyTo(dest);
    }

    private static Guid ReadGuidBigEndian(ReadOnlySpan<byte> src) => new(src, bigEndian: true);
}

internal static class Base64Url
{
    public static string Encode(ReadOnlySpan<byte> bytes)
    {
        var s = Convert.ToBase64String(bytes);
        return s.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public static byte[] Decode(ReadOnlySpan<char> input)
    {
        var s = new string(input).Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2:
                s += "==";
                break;
            case 3:
                s += "=";
                break;
            case 1:
                throw new FormatException("invalid base64url length");
        }
        return Convert.FromBase64String(s);
    }
}
