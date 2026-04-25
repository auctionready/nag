using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Nag.Api.Auth;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Nag.Tests.Infrastructure;
using Shouldly;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class AccountsEndpointsTests : IClassFixture<AccountsEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public AccountsEndpointsTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_accounts";
    }

    public sealed class Factory : NagApiFactory;

    private HttpClient AuthedClient()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            _factory.ApiKey
        );
        return c;
    }

    /// <summary>
    /// Bootstraps an account+device pair the way `POST /devices/register`
    /// would in production, so the upgrade endpoint has something to bind to.
    /// </summary>
    private async Task<(Guid AccountId, Guid DeviceId)> RegisterDeviceAsync(HttpClient client)
    {
        var deviceId = Guid.NewGuid();
        var resp = await client.PostAsJsonAsync(
            "/devices/register",
            new RegisterDeviceRequest(deviceId, "test")
        );
        resp.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<RegisterDeviceResponse>();
        return (body!.AccountId, body.DeviceId);
    }

    [Fact]
    public async Task upgrades_an_anonymous_account_with_a_valid_idp_token()
    {
        var client = AuthedClient();
        var (accountId, deviceId) = await RegisterDeviceAsync(client);
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_abc");

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "any-token")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<UpgradeAccountResponse>();
        body!.AccountId.ShouldBe(accountId);
        body.IdpSubject.ShouldBe("user_abc");

        // The Account document is now persisted with the IdpSubject.
        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        var account = await session.LoadAsync<Account>(accountId);
        account!.IdpSubject.ShouldBe("user_abc");
        account.UpgradedAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task upgrading_twice_with_the_same_subject_is_idempotent()
    {
        var client = AuthedClient();
        var (accountId, deviceId) = await RegisterDeviceAsync(client);
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_xyz");

        var first = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "any-token")
        );
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        var firstBody = await first.Content.ReadFromJsonAsync<UpgradeAccountResponse>();

        var second = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "any-token")
        );
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var secondBody = await second.Content.ReadFromJsonAsync<UpgradeAccountResponse>();
        secondBody!.AccountId.ShouldBe(accountId);
        secondBody.IdpSubject.ShouldBe("user_xyz");
        secondBody.UpgradedAt.ShouldBe(firstBody!.UpgradedAt);
    }

    [Fact]
    public async Task rebinding_an_already_upgraded_account_to_a_different_subject_returns_409()
    {
        var client = AuthedClient();
        var (_, deviceId) = await RegisterDeviceAsync(client);

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_first");
        var first = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "first-token")
        );
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_second");
        var second = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "second-token")
        );
        second.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task rejects_an_idp_subject_already_bound_to_a_different_account()
    {
        var client = AuthedClient();
        var (_, firstDeviceId) = await RegisterDeviceAsync(client);
        var (_, secondDeviceId) = await RegisterDeviceAsync(client);

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_shared");
        var first = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(firstDeviceId, "token-a")
        );
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        // Same Clerk identity, different anonymous account — must not silently
        // merge them. The user has to pair (which we'll add in commit 3).
        var second = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(secondDeviceId, "token-b")
        );
        second.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task an_invalid_idp_token_returns_401()
    {
        var client = AuthedClient();
        var (_, deviceId) = await RegisterDeviceAsync(client);
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Failure("signature mismatch");

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "garbage")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task an_unknown_device_returns_404()
    {
        var client = AuthedClient();
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_abc");

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(Guid.NewGuid(), "any-token")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task missing_device_id_returns_400()
    {
        var client = AuthedClient();

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(Guid.Empty, "any-token")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task missing_idp_token_returns_400()
    {
        var client = AuthedClient();
        var (_, deviceId) = await RegisterDeviceAsync(client);

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task requires_authentication()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(Guid.NewGuid(), "any-token")
        );
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
