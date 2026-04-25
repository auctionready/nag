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
            "/devices/register",
            new RegisterDeviceRequest(deviceId, "first-phone")
        );
        registerResp.StatusCode.ShouldBe(HttpStatusCode.OK);
        var registered = await registerResp.Content.ReadFromJsonAsync<RegisterDeviceResponse>();

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);
        var upgradeResp = await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceId, "any-token")
        );
        upgradeResp.StatusCode.ShouldBe(HttpStatusCode.OK);

        return (registered!.AccountId, sub);
    }

    [Fact]
    public async Task pairs_a_new_device_with_an_existing_upgraded_account()
    {
        var client = AuthedClient();
        var (accountId, _) = await SeedUpgradedAccountAsync(client);
        var newDeviceId = Guid.NewGuid();

        var response = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(newDeviceId, "any-token", "second-phone")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PairDeviceResponse>();
        body!.AccountId.ShouldBe(accountId);
        body.DeviceId.ShouldBe(newDeviceId);
    }

    [Fact]
    public async Task re_pairing_the_same_device_id_is_idempotent()
    {
        var client = AuthedClient();
        var (accountId, _) = await SeedUpgradedAccountAsync(client);
        var newDeviceId = Guid.NewGuid();

        var first = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(newDeviceId, "any-token", null)
        );
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        var firstBody = await first.Content.ReadFromJsonAsync<PairDeviceResponse>();

        var second = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(newDeviceId, "any-token", "renamed")
        );
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var secondBody = await second.Content.ReadFromJsonAsync<PairDeviceResponse>();

        secondBody!.AccountId.ShouldBe(accountId);
        secondBody.DeviceId.ShouldBe(newDeviceId);
        secondBody.RegisteredAt.ShouldBe(firstBody!.RegisteredAt);
    }

    [Fact]
    public async Task pairing_against_a_subject_with_no_upgraded_account_returns_404()
    {
        var client = AuthedClient();
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_with_no_upgrade");

        var response = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(Guid.NewGuid(), "any-token", null)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task pairing_a_device_id_already_owned_by_another_account_returns_409()
    {
        var client = AuthedClient();
        var subA = $"user_{Guid.NewGuid():N}";

        // Account A owns deviceX (registered, anonymous, then upgraded).
        var deviceX = Guid.NewGuid();
        await client.PostAsJsonAsync("/devices/register", new RegisterDeviceRequest(deviceX, null));
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(subA);
        await client.PostAsJsonAsync(
            "/accounts/upgrade",
            new UpgradeAccountRequest(deviceX, "token-a")
        );

        // Account B exists, upgraded to a different identity.
        var (_, subB) = await SeedUpgradedAccountAsync(client);

        // Trying to pair deviceX into account B (verified as subB) must conflict.
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(subB);
        var response = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(deviceX, "token-b", null)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task an_invalid_idp_token_returns_401()
    {
        var client = AuthedClient();
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Failure("signature mismatch");

        var response = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(Guid.NewGuid(), "garbage", null)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task missing_device_id_returns_400()
    {
        var client = AuthedClient();
        var response = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(Guid.Empty, "any-token", null)
        );
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task missing_idp_token_returns_400()
    {
        var client = AuthedClient();
        var response = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(Guid.NewGuid(), "", null)
        );
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task requires_authentication()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/devices/pair",
            new PairDeviceRequest(Guid.NewGuid(), "any-token", null)
        );
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
