using System.Security.Cryptography;
using System.Text;

namespace Nag.Api.Auth;

public sealed class BearerKeyMiddleware
{
    private const string Scheme = "Bearer ";
    private readonly RequestDelegate _next;
    private readonly byte[] _expected;

    public BearerKeyMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        var key = config["Nag:ApiKey"];
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException(
                "Nag:ApiKey is not configured. Set Nag__ApiKey environment variable."
            );
        _expected = Encoding.UTF8.GetBytes(key);
    }

    public Task InvokeAsync(HttpContext ctx)
    {
        if (ctx.Request.Path.StartsWithSegments("/health"))
        {
            return _next(ctx);
        }

        if (ctx.Request.Path.StartsWithSegments("/swagger"))
        {
            return _next(ctx);
        }

        var header = ctx.Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(header) || !header.StartsWith(Scheme, StringComparison.Ordinal))
        {
            return Reject(ctx);
        }

        var providedKey = header[Scheme.Length..];
        var provided = Encoding.UTF8.GetBytes(providedKey);

        if (!CryptographicOperations.FixedTimeEquals(provided, _expected))
        {
            return Reject(ctx);
        }

        return _next(ctx);
    }

    private static Task Reject(HttpContext ctx)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }
}
