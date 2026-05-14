using System.Net.Http.Headers;
using Alba;
using Marten;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Nag.Api.Auth;
using Nag.Core.Domain;

namespace Nag.Tests.Infrastructure;

/// <summary>
/// Test fixture that boots <see cref="Nag.Api.Program"/> via Alba. Alba is
/// the JasperFx-aware sibling of Microsoft's WebApplicationFactory: it knows
/// how to compose with `RunJasperFxCommands` so the host actually starts
/// during tests (which WAF can't — it leaves TestServer.Application null).
/// </summary>
public class NagApiFactory : IAsyncLifetime
{
    private IAlbaHost? _host;
    private readonly SemaphoreSlim _initLock = new(1, 1);

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

    /// <summary>
    /// Per-class fixtures want to mutate <see cref="ConnectionString"/> in
    /// the test class constructor (which runs *after* the fixture's
    /// constructor). Defer the Alba host build until the first
    /// <see cref="CreateClient"/> call so those mutations are picked up.
    /// </summary>
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        if (_host is not null)
        {
            await _host.DisposeAsync();
        }
    }

    public IServiceProvider Services => GetHost().Services;

    public IDeviceTokenIssuer DeviceTokens => Services.GetRequiredService<IDeviceTokenIssuer>();

    /// <summary>
    /// Mints an HMAC device token without going through
    /// <c>/devices/register</c>, and (by default) seeds an <c>Account</c>
    /// row so the auth handler's live-account check passes. Pass
    /// <paramref name="seedAccount"/>=<c>false</c> to mint a token whose
    /// account does not exist — used by the negative tests that exercise
    /// the "forged token against a missing account" path.
    /// </summary>
    public string IssueDeviceToken(
        Guid? accountId = null,
        Guid? deviceId = null,
        bool seedAccount = true
    )
    {
        var aid = accountId ?? Guid.NewGuid();
        var did = deviceId ?? Guid.NewGuid();
        if (seedAccount)
        {
            SeedAccount(aid);
        }
        return DeviceTokens.Issue(aid, did);
    }

    private void SeedAccount(Guid accountId)
    {
        using var scope = Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        session.Store(new Account { Id = accountId, CreatedAt = DateTimeOffset.UtcNow });
        session.SaveChangesAsync().GetAwaiter().GetResult();
    }

    public HttpClient CreateClient() => GetHost().Server.CreateClient();

    public HttpClient CreateAuthedClient(string? bearerToken = null)
    {
        var token = bearerToken ?? IssueDeviceToken();
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private IAlbaHost GetHost()
    {
        if (_host is not null)
        {
            return _host;
        }

        _initLock.Wait();
        try
        {
            if (_host is not null)
            {
                return _host;
            }

            _host = AlbaHost
                .For<Nag.Api.Program>(builder =>
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
                })
                .GetAwaiter()
                .GetResult();

            return _host;
        }
        finally
        {
            _initLock.Release();
        }
    }
}

public sealed class StubClerkTokenVerifier : IClerkTokenVerifier
{
    public Func<string, ClerkTokenVerificationResult> Behavior { get; set; } =
        _ => ClerkTokenVerificationResult.Failure("no behavior configured");

    public Task<ClerkTokenVerificationResult> VerifyAsync(string token, CancellationToken ct) =>
        Task.FromResult(Behavior(token));
}
