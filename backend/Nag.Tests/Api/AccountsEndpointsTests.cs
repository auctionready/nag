using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Nag.Api.Auth;
using Nag.Core;
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
    /// Bootstraps an account+device pair the way <c>POST /devices/register</c>
    /// would in production. Returns an authed client (Bearer = the freshly
    /// issued device token) ready to call any of the account endpoints.
    /// </summary>
    private async Task<(Guid AccountId, Guid DeviceId, HttpClient Client)> RegisterDeviceAsync()
    {
        var client = _factory.CreateClient();
        var deviceId = Guid.NewGuid();
        var resp = await client.PostAsJsonAsync(
            "/devices/register",
            new RegisterDeviceRequest(deviceId, "test")
        );
        resp.StatusCode.ShouldBe(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<RegisterDeviceResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            body!.DeviceToken
        );
        return (body.AccountId, body.DeviceId, client);
    }

    private static Task<HttpResponseMessage> PostIdentityAsync(
        HttpClient client,
        string idpToken
    ) => client.PostAsJsonAsync("/accounts/me/identity", new SetAccountIdentityRequest(idpToken));

    private static Task<HttpResponseMessage> DeleteByClerkIdentityAsync(
        HttpClient client,
        string idpToken
    ) =>
        client.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/accounts/by-clerk-identity")
            {
                Content = JsonContent.Create(new ReleaseAccountIdentityRequest(idpToken)),
            }
        );

    [Fact]
    public async Task upgrades_an_anonymous_account_with_a_valid_idp_token()
    {
        var (accountId, _, client) = await RegisterDeviceAsync();
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_abc");

        var response = await PostIdentityAsync(client, "any-token");

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        response.Headers.Location!.ToString().ShouldBe("/accounts/me/identity");
        var body = await response.Content.ReadFromJsonAsync<AccountIdentity>();
        body!.IdpSubject.ShouldBe("user_abc");

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
        var (_, _, client) = await RegisterDeviceAsync();
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_xyz");

        var first = await PostIdentityAsync(client, "any-token");
        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        var firstBody = await first.Content.ReadFromJsonAsync<AccountIdentity>();

        var second = await PostIdentityAsync(client, "any-token");
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.Content.Headers.ContentLocation!.ToString().ShouldBe("/accounts/me/identity");
        var secondBody = await second.Content.ReadFromJsonAsync<AccountIdentity>();
        secondBody!.IdpSubject.ShouldBe("user_xyz");
        secondBody.UpgradedAt.ShouldBe(firstBody!.UpgradedAt);
    }

    [Fact]
    public async Task rebinding_an_already_upgraded_account_to_a_different_subject_returns_409()
    {
        var (_, _, client) = await RegisterDeviceAsync();

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_first");
        (await PostIdentityAsync(client, "first-token")).StatusCode.ShouldBe(
            HttpStatusCode.Created
        );

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_second");
        (await PostIdentityAsync(client, "second-token")).StatusCode.ShouldBe(
            HttpStatusCode.Conflict
        );
    }

    [Fact]
    public async Task rejects_an_idp_subject_already_bound_to_a_different_account()
    {
        var (_, _, clientA) = await RegisterDeviceAsync();
        var (_, _, clientB) = await RegisterDeviceAsync();

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success("user_shared");
        (await PostIdentityAsync(clientA, "token-a")).StatusCode.ShouldBe(HttpStatusCode.Created);

        // Same Clerk identity, different anonymous account — must not silently
        // merge them. The user has to pair instead.
        (await PostIdentityAsync(clientB, "token-b")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task releasing_then_re_binding_moves_the_identity_to_a_new_account()
    {
        var (firstAccountId, _, clientA) = await RegisterDeviceAsync();
        var (secondAccountId, _, clientB) = await RegisterDeviceAsync();

        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_take_over");
        (await PostIdentityAsync(clientA, "token-a")).StatusCode.ShouldBe(HttpStatusCode.Created);

        // clientB initially gets 409 because clientA owns the identity.
        (await PostIdentityAsync(clientB, "token-b")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // clientB explicitly releases the existing binding (proves
        // ownership via the Clerk JWT), then re-binds. Two steps replace
        // the old force=true escape hatch.
        (await DeleteByClerkIdentityAsync(clientB, "token-b")).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        var bound = await PostIdentityAsync(clientB, "token-b");
        bound.StatusCode.ShouldBe(HttpStatusCode.Created);

        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        var loser = await session.LoadAsync<Account>(firstAccountId);
        loser!.IdpSubject.ShouldBeNull();
        loser.UpgradedAt.ShouldBeNull();
        var winner = await session.LoadAsync<Account>(secondAccountId);
        winner!.IdpSubject.ShouldBe("user_take_over");
        winner.UpgradedAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task release_by_clerk_identity_when_no_one_owns_it_is_a_no_op_204()
    {
        var (_, _, client) = await RegisterDeviceAsync();
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_nobody_owns");

        var response = await DeleteByClerkIdentityAsync(client, "any-token");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task release_by_clerk_identity_with_an_invalid_token_returns_401()
    {
        var (_, _, client) = await RegisterDeviceAsync();
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Failure("signature mismatch");

        var response = await DeleteByClerkIdentityAsync(client, "garbage");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task an_invalid_idp_token_returns_401()
    {
        var (_, _, client) = await RegisterDeviceAsync();
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Failure("signature mismatch");

        var response = await PostIdentityAsync(client, "garbage");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task setting_identity_without_a_device_token_returns_401()
    {
        var client = _factory.CreateClient();

        var response = await PostIdentityAsync(client, "any-token");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task missing_idp_token_returns_400()
    {
        var (_, _, client) = await RegisterDeviceAsync();

        var response = await PostIdentityAsync(client, "");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task get_identity_returns_the_bound_subject()
    {
        var (_, _, client) = await RegisterAndUpgradeAsync("user_get_identity");

        var response = await client.GetAsync("/accounts/me/identity");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<AccountIdentity>();
        body!.IdpSubject.ShouldBe("user_get_identity");
        body.UpgradedAt.ShouldNotBe(default);
    }

    [Fact]
    public async Task get_identity_on_an_anonymous_account_returns_404()
    {
        var (_, _, client) = await RegisterDeviceAsync();

        var response = await client.GetAsync("/accounts/me/identity");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task get_identity_without_a_device_token_returns_401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/accounts/me/identity");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    /// <summary>
    /// Bootstraps a registered+upgraded account and returns the authed
    /// HTTP client (Bearer = the device token from <c>/devices/register</c>),
    /// ready to call <c>DELETE /accounts/me/identity</c>.
    /// </summary>
    private async Task<(Guid AccountId, Guid DeviceId, HttpClient Client)> RegisterAndUpgradeAsync(
        string sub
    )
    {
        var (accountId, deviceId, client) = await RegisterDeviceAsync();
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);
        (await PostIdentityAsync(client, "any-token")).StatusCode.ShouldBe(HttpStatusCode.Created);
        return (accountId, deviceId, client);
    }

#if RESERVED_ENDPOINTS
    // These tests cover `DELETE /accounts/me/identity`, which is gated
    // off in production builds — see the matching `#if` in
    // `AccountsEndpoints.cs`. Re-define `RESERVED_ENDPOINTS` to bring
    // both back together.

    [Fact]
    public async Task unbind_clears_idp_subject_and_returns_204()
    {
        var (accountId, _, client) = await RegisterAndUpgradeAsync("user_unbind_clear");

        var response = await client.DeleteAsync("/accounts/me/identity");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        var account = await session.LoadAsync<Account>(accountId);
        account!.IdpSubject.ShouldBeNull();
        account.UpgradedAt.ShouldBeNull();
    }

    [Fact]
    public async Task unbind_lets_the_account_be_rebound_to_a_different_subject()
    {
        var (accountId, _, client) = await RegisterAndUpgradeAsync("user_unbind_rebind_a");

        (await client.DeleteAsync("/accounts/me/identity")).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );

        // Re-bind via POST /accounts/me/identity — previously this would
        // have hit "account is already bound to a different identity";
        // after unbind it succeeds.
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_unbind_rebind_b");
        var rebind = await PostIdentityAsync(client, "second-token");
        rebind.StatusCode.ShouldBe(HttpStatusCode.Created);
        var body = await rebind.Content.ReadFromJsonAsync<AccountIdentity>();
        body!.IdpSubject.ShouldBe("user_unbind_rebind_b");

        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        (await session.LoadAsync<Account>(accountId))!.IdpSubject.ShouldBe("user_unbind_rebind_b");
    }

    [Fact]
    public async Task unbind_is_idempotent_on_an_already_anonymous_account()
    {
        // Register but never upgrade — IdpSubject is null from the start.
        var (_, _, authed) = await RegisterDeviceAsync();

        var response = await authed.DeleteAsync("/accounts/me/identity");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task unbind_without_a_token_returns_401()
    {
        var client = _factory.CreateClient();

        var response = await client.DeleteAsync("/accounts/me/identity");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task unbind_with_an_unknown_account_returns_401()
    {
        // Forge a device token whose account_id claim points at an account
        // that was never persisted. The auth handler's live-account check
        // rejects the token before the endpoint runs, so the response is
        // 401 (not 404 from the endpoint's own LoadAsync<Account>).
        var token = _factory.IssueDeviceToken(Guid.NewGuid(), Guid.NewGuid(), seedAccount: false);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.DeleteAsync("/accounts/me/identity");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
#endif

    [Fact]
    public async Task delete_me_removes_the_account_devices_and_per_account_data()
    {
        var (accountId, deviceId, client) = await RegisterAndUpgradeAsync("user_delete_me");

        // Seed a habit so there's an event + read-model row tagged with
        // this account's tenant id; verifies the cascade actually fires.
        var habitId = Guid.NewGuid();
        var seed = await client.PostAsJsonAsync(
            "/events",
            new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new { type = "HabitCreated", payload = new { habitId, title = "Read" } },
                },
            }
        );
        seed.StatusCode.ShouldBe(HttpStatusCode.Created);

        var response = await client.DeleteAsync("/accounts/me");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        (await session.LoadAsync<Account>(accountId)).ShouldBeNull();
        (await session.LoadAsync<Device>(deviceId)).ShouldBeNull();

        // Tenanted reads use the account_id claim — go through the store
        // directly with that tenant to confirm the per-account rows are
        // gone, not just hidden by a different tenant context.
        await using var tenanted = scope
            .ServiceProvider.GetRequiredService<IDocumentStore>()
            .LightweightSession(accountId.ToString("D"));
        var events = await tenanted.Events.FetchStreamAsync(NagStreams.Root);
        events.ShouldBeEmpty();
    }

    [Fact]
    public async Task delete_me_invalidates_the_device_token()
    {
        var (_, _, client) = await RegisterAndUpgradeAsync("user_delete_then_device");

        // Sanity: the device token works against a protected endpoint
        // before deletion.
        (await client.GetAsync("/home-board")).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await client.DeleteAsync("/accounts/me")).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        // The very same client + bearer now fails — the auth handler's
        // live-account check sees the row is gone (cache was invalidated
        // by the delete endpoint) and rejects the token. Without that
        // check, the orphan tenant id would silently accept writes.
        (await client.GetAsync("/home-board")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task delete_me_lets_a_subsequent_clerk_token_for_the_same_identity_get_401()
    {
        var (_, _, client) = await RegisterAndUpgradeAsync("user_delete_then_clerk");

        (await client.DeleteAsync("/accounts/me")).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        // The auth handler caches sub→accountId; the endpoint invalidates
        // that cache so a Clerk-token request after delete fails with
        // "no account is bound to this Clerk identity" (401), not 200
        // against the now-dead account row.
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_delete_then_clerk");
        var clerk = _factory.CreateClient();
        clerk.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            "ey.fake.clerk"
        );
        var response = await clerk.GetAsync("/home-board");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task delete_me_without_a_token_returns_401()
    {
        var client = _factory.CreateClient();

        var response = await client.DeleteAsync("/accounts/me");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task delete_me_with_an_unknown_account_returns_401()
    {
        // Forged token: signature valid, but the account_id claim points at
        // a row that was never persisted. The auth handler's live-account
        // check rejects this before the endpoint runs.
        var token = _factory.IssueDeviceToken(Guid.NewGuid(), Guid.NewGuid(), seedAccount: false);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.DeleteAsync("/accounts/me");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task delete_me_only_touches_the_callers_account()
    {
        var (victimAccountId, _, _) = await RegisterAndUpgradeAsync("user_victim");
        var (attackerAccountId, _, attacker) = await RegisterAndUpgradeAsync("user_attacker");

        // The endpoint reads the account id from the principal, never the
        // request — so the attacker's call must leave the victim alone
        // even if it could somehow hint at a different id.
        var response = await attacker.DeleteAsync("/accounts/me");
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        (await session.LoadAsync<Account>(attackerAccountId)).ShouldBeNull();
        (await session.LoadAsync<Account>(victimAccountId)).ShouldNotBeNull();
    }
}
