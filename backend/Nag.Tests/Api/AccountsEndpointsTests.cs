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
        var client = _factory.CreateClient();
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
        body.DeviceToken.ShouldNotBeNullOrWhiteSpace();

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
        var client = _factory.CreateClient();
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
        var client = _factory.CreateClient();
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
        var client = _factory.CreateClient();
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
    public async Task force_upgrade_moves_the_identity_from_the_other_account_to_this_one()
    {
        var client = _factory.CreateClient();
        var (firstAccountId, firstDeviceId) = await RegisterDeviceAsync(client);
        var (secondAccountId, secondDeviceId) = await RegisterDeviceAsync(client);

        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_force_take_over");
        var first = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(firstDeviceId, "token-a")
        );
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        // Second device, same Clerk identity, with Force=true. Without
        // Force this would be 409; with it, the identity moves and the
        // first account is left orphaned (rows kept, IdpSubject cleared).
        var second = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(secondDeviceId, "token-b", Force: true)
        );

        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await second.Content.ReadFromJsonAsync<UpgradeAccountResponse>();
        body!.AccountId.ShouldBe(secondAccountId);
        body.IdpSubject.ShouldBe("user_force_take_over");

        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        var loser = await session.LoadAsync<Account>(firstAccountId);
        loser!.IdpSubject.ShouldBeNull();
        loser.UpgradedAt.ShouldBeNull();
        var winner = await session.LoadAsync<Account>(secondAccountId);
        winner!.IdpSubject.ShouldBe("user_force_take_over");
        winner.UpgradedAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task force_upgrade_without_an_existing_claim_behaves_like_a_normal_upgrade()
    {
        var client = _factory.CreateClient();
        var (accountId, deviceId) = await RegisterDeviceAsync(client);
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_force_no_op");

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "any-token", Force: true)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<UpgradeAccountResponse>();
        body!.AccountId.ShouldBe(accountId);
        body.IdpSubject.ShouldBe("user_force_no_op");
    }

    [Fact]
    public async Task an_invalid_idp_token_returns_401()
    {
        var client = _factory.CreateClient();
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
        var client = _factory.CreateClient();
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
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(Guid.Empty, "any-token")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task missing_idp_token_returns_400()
    {
        var client = _factory.CreateClient();
        var (_, deviceId) = await RegisterDeviceAsync(client);

        var response = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    /// <summary>
    /// Bootstraps a registered+upgraded account and returns an HTTP client
    /// authenticated with that account's device token, ready to call
    /// <c>/accounts/unbind</c>.
    /// </summary>
    private async Task<(Guid AccountId, Guid DeviceId, HttpClient Client)> RegisterAndUpgradeAsync(
        string sub
    )
    {
        var bootstrap = _factory.CreateClient();
        var (accountId, deviceId) = await RegisterDeviceAsync(bootstrap);
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);
        var upgrade = await bootstrap.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "any-token")
        );
        upgrade.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await upgrade.Content.ReadFromJsonAsync<UpgradeAccountResponse>();

        var authed = _factory.CreateClient();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            body!.DeviceToken
        );
        return (accountId, deviceId, authed);
    }

    [Fact]
    public async Task unbind_clears_idp_subject_and_returns_200()
    {
        var (accountId, _, client) = await RegisterAndUpgradeAsync("user_unbind_clear");

        var response = await client.PostAsync("/accounts/unbind", content: null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<UnbindAccountResponse>();
        body!.AccountId.ShouldBe(accountId);

        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        var account = await session.LoadAsync<Account>(accountId);
        account!.IdpSubject.ShouldBeNull();
        account.UpgradedAt.ShouldBeNull();
    }

    [Fact]
    public async Task unbind_lets_the_account_be_rebound_to_a_different_subject()
    {
        var (accountId, deviceId, client) = await RegisterAndUpgradeAsync("user_unbind_rebind_a");

        (await client.PostAsync("/accounts/unbind", content: null)).StatusCode.ShouldBe(
            HttpStatusCode.OK
        );

        // Re-bind via /accounts/upgrade — previously this would have hit
        // "account is already bound to a different identity"; after unbind
        // it succeeds.
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_unbind_rebind_b");
        var rebind = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "second-token")
        );
        rebind.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await rebind.Content.ReadFromJsonAsync<UpgradeAccountResponse>();
        body!.AccountId.ShouldBe(accountId);
        body.IdpSubject.ShouldBe("user_unbind_rebind_b");
    }

    [Fact]
    public async Task unbind_is_idempotent_on_an_already_anonymous_account()
    {
        // Register but never upgrade — IdpSubject is null from the start.
        var bootstrap = _factory.CreateClient();
        var (accountId, deviceId) = await RegisterDeviceAsync(bootstrap);
        var token = _factory.IssueDeviceToken(accountId, deviceId);
        var authed = _factory.CreateClient();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await authed.PostAsync("/accounts/unbind", content: null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<UnbindAccountResponse>();
        body!.AccountId.ShouldBe(accountId);
    }

    [Fact]
    public async Task unbind_without_a_token_returns_401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/accounts/unbind", content: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task unbind_with_an_unknown_account_returns_404()
    {
        // Forge a device token whose account_id claim points at an account
        // that was never persisted.
        var token = _factory.IssueDeviceToken(Guid.NewGuid(), Guid.NewGuid());
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsync("/accounts/unbind", content: null);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
