using System.Net.Http.Headers;
using Marten;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Nag.Api.Auth;

namespace Nag.Tests.Infrastructure;

public class NagApiFactory : WebApplicationFactory<Program>
{
    public string ConnectionString { get; set; } = "";
    public string SchemaName { get; set; } = "nag_api_test";

    /// <summary>
    /// Fixed test secret for the device-token HMAC. Long enough to be a
    /// real-shaped secret; exact value doesn't matter as long as it's
    /// stable across the factory's lifetime so tokens issued via
    /// <see cref="DeviceTokens"/> validate against the running app.
    /// </summary>
    public string DeviceTokenSecret { get; set; } = "test-device-token-secret-0123456789abcdef";

    /// <summary>
    /// Tests configure this to control what `IClerkTokenVerifier` returns.
    /// Default: rejects every token. Tests that exercise the upgrade or
    /// pair endpoints set <see cref="StubClerkTokenVerifier.Behavior"/>
    /// before issuing the request.
    /// </summary>
    public StubClerkTokenVerifier ClerkVerifier { get; } = new();

    public IDeviceTokenIssuer DeviceTokens => Services.GetRequiredService<IDeviceTokenIssuer>();

    /// <summary>
    /// Mints an HMAC device token without going through
    /// <c>/devices/register</c>. Useful for tests that exercise
    /// already-protected endpoints and don't care about the bootstrap
    /// flow — the auth handler validates the signature, not whether the
    /// referenced account/device actually exists in Marten.
    /// </summary>
    public string IssueDeviceToken(Guid? accountId = null, Guid? deviceId = null) =>
        DeviceTokens.Issue(accountId ?? Guid.NewGuid(), deviceId ?? Guid.NewGuid());

    public HttpClient CreateAuthedClient(string? bearerToken = null)
    {
        var token = bearerToken ?? IssueDeviceToken();
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Nag:DeviceToken:Secret", DeviceTokenSecret);
        builder.UseSetting("Nag:SchemaName", SchemaName);
        builder.UseSetting("ConnectionStrings:Nag", ConnectionString);

        builder.ConfigureServices(services =>
        {
            services.PostConfigure<StoreOptions>(opts =>
            {
                opts.Connection(ConnectionString);
                if (!string.IsNullOrWhiteSpace(SchemaName))
                {
                    opts.DatabaseSchemaName = SchemaName;
                    opts.Events.DatabaseSchemaName = SchemaName;
                }
            });

            // Override the production registration (or register if Program.cs
            // skipped because Nag:ClerkIssuer wasn't set). Last registration
            // wins on `GetRequiredService<IClerkTokenVerifier>()`.
            services.AddSingleton<IClerkTokenVerifier>(ClerkVerifier);
        });
    }
}

public sealed class StubClerkTokenVerifier : IClerkTokenVerifier
{
    public Func<string, ClerkTokenVerificationResult> Behavior { get; set; } =
        _ => ClerkTokenVerificationResult.Failure("no behavior configured");

    public Task<ClerkTokenVerificationResult> VerifyAsync(string token, CancellationToken ct) =>
        Task.FromResult(Behavior(token));
}
