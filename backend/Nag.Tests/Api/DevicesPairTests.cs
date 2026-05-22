using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Nag.Api.Auth;
using Nag.Core.Contracts;
using Nag.Tests.Infrastructure;
using Shouldly;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class DevicesPairTests : IClassFixture<DevicesPairTests.Factory>
{
    private readonly Factory _factory;

    public DevicesPairTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_devices_pair";
    }

    public sealed class Factory : NagApiFactory;

    /// <summary>
    /// Registers an anonymous device, then upgrades that account to be bound
    /// to a freshly-generated Clerk subject. Each call uses a unique sub so
    /// tests in this class — which share a Marten schema via the
    /// `IClassFixture` lifecycle — don't collide on the
    /// "sub already bound to a different account" guard. Returns both the
    /// accountId and the sub so the test can configure the verifier
    /// behavior for the subsequent pair call.
    /// </summary>
    private async Task<(Guid AccountId, string Sub)> SeedUpgradedAccountAsync(HttpClient client)
    {
        var sub = $"user_{Guid.NewGuid():N}";
        var deviceId = Guid.NewGuid();
        var registerResp = await client.PostAsJsonAsync(
            "/devices",
            new RegisterDeviceRequest(deviceId, "first-phone")
        );
        registerResp.StatusCode.ShouldBe(HttpStatusCode.Created);
        var registered = await registerResp.Content.ReadFromJsonAsync<RegisterDeviceResponse>();

        // PUT /accounts/me/identity requires the device Bearer; install it on
        // a sibling client (don't mutate the caller's anonymous client because
        // some tests intentionally use anonymous flows below).
        var authed = _factory.CreateClient();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            registered!.DeviceToken
        );

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);
        var upgradeResp = await authed.PostAsJsonAsync(
            "/accounts/me/identity",
            new SetAccountIdentityRequest("any-token")
        );
        upgradeResp.StatusCode.ShouldBe(HttpStatusCode.Created);

        return (registered.AccountId, sub);
    }

    [Fact]
    public async Task pairs_a_new_device_with_an_existing_upgraded_account()
    {
        var client = _factory.CreateClient();
        var (accountId, _) = await SeedUpgradedAccountAsync(client);
        var newDeviceId = Guid.NewGuid();

        var response = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(newDeviceId, "any-token", "second-phone")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        response.Headers.Location!.ToString().ShouldBe("/devices/me");
        var body = await response.Content.ReadFromJsonAsync<PairDeviceResponse>();
        body!.AccountId.ShouldBe(accountId);
        body.DeviceId.ShouldBe(newDeviceId);
        body.DeviceToken.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task re_pairing_the_same_device_id_is_idempotent()
    {
        var client = _factory.CreateClient();
        var (accountId, _) = await SeedUpgradedAccountAsync(client);
        var newDeviceId = Guid.NewGuid();

        var first = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(newDeviceId, "any-token", null)
        );
        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        var firstBody = await first.Content.ReadFromJsonAsync<PairDeviceResponse>();

        var second = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(newDeviceId, "any-token", "renamed")
        );
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.Content.Headers.ContentLocation!.ToString().ShouldBe("/devices/me");
        var secondBody = await second.Content.ReadFromJsonAsync<PairDeviceResponse>();

        secondBody!.AccountId.ShouldBe(accountId);
        secondBody.DeviceId.ShouldBe(newDeviceId);
        secondBody.RegisteredAt.ShouldBe(firstBody!.RegisteredAt);
        secondBody.DeviceToken.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task pairing_against_a_subject_with_no_upgraded_account_returns_404()
    {
        var client = _factory.CreateClient();
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_with_no_upgrade");

        var response = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(Guid.NewGuid(), "any-token", null)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task pairing_a_device_id_already_owned_by_another_account_returns_409()
    {
        var client = _factory.CreateClient();
        var subA = $"user_{Guid.NewGuid():N}";

        // Account A owns deviceX (registered, anonymous, then upgraded).
        var deviceX = Guid.NewGuid();
        var registerA = await client.PostAsJsonAsync(
            "/devices",
            new RegisterDeviceRequest(deviceX, null)
        );
        var registeredA = await registerA.Content.ReadFromJsonAsync<RegisterDeviceResponse>();
        var authedA = _factory.CreateClient();
        authedA.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            registeredA!.DeviceToken
        );
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(subA);
        await authedA.PostAsJsonAsync(
            "/accounts/me/identity",
            new SetAccountIdentityRequest("token-a")
        );

        // Account B exists, upgraded to a different identity.
        var (_, subB) = await SeedUpgradedAccountAsync(client);

        // Trying to pair deviceX into account B (verified as subB) must conflict.
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(subB);
        var response = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(deviceX, "token-b", null)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task pairing_re_parents_a_device_whose_current_account_is_anonymous()
    {
        // The typical second-device flow: a fresh install auto-registered an
        // anonymous account at boot, the user then signs in with a Clerk
        // identity that already owns an upgraded account. POST /accounts/me/identity
        // refuses (sub already bound elsewhere) — the app falls back to
        // POST /accounts/me/devices, which must re-parent this device onto the
        // existing account so subsequent /sync calls return that account's data.
        var client = _factory.CreateClient();
        var (existingAccountId, sub) = await SeedUpgradedAccountAsync(client);

        var newDeviceId = Guid.NewGuid();
        var registerResp = await client.PostAsJsonAsync(
            "/devices",
            new RegisterDeviceRequest(newDeviceId, "second-phone")
        );
        registerResp.StatusCode.ShouldBe(HttpStatusCode.Created);
        var registered = await registerResp.Content.ReadFromJsonAsync<RegisterDeviceResponse>();
        var anonymousAccountId = registered!.AccountId;
        anonymousAccountId.ShouldNotBe(existingAccountId);

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);
        var pairResp = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(newDeviceId, "any-token", null)
        );

        pairResp.StatusCode.ShouldBe(HttpStatusCode.OK);
        var paired = await pairResp.Content.ReadFromJsonAsync<PairDeviceResponse>();
        paired!.AccountId.ShouldBe(existingAccountId);
        paired.DeviceId.ShouldBe(newDeviceId);
        paired.DeviceToken.ShouldNotBeNullOrWhiteSpace();

        // Re-pairing is idempotent now that the device sits on the new account.
        var second = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(newDeviceId, "any-token", null)
        );
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var secondBody = await second.Content.ReadFromJsonAsync<PairDeviceResponse>();
        secondBody!.AccountId.ShouldBe(existingAccountId);
    }

    [Fact]
    public async Task an_invalid_idp_token_returns_401()
    {
        var client = _factory.CreateClient();
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Failure("signature mismatch");

        var response = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(Guid.NewGuid(), "garbage", null)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task missing_device_id_returns_400()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(Guid.Empty, "any-token", null)
        );
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task missing_idp_token_returns_400()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(Guid.NewGuid(), "", null)
        );
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
