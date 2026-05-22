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

// `DELETE /devices/me` is gated off in production builds — see the
// matching `#if` in `DevicesEndpoints.cs`. The whole test class
// compiles together with the endpoint; re-define `RESERVED_ENDPOINTS`
// to bring both back.
#if RESERVED_ENDPOINTS
[Collection(PostgresCollection.Name)]
public class DevicesUnregisterTests : IClassFixture<DevicesUnregisterTests.Factory>
{
    private readonly Factory _factory;

    public DevicesUnregisterTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_devices_unregister";
    }

    public sealed class Factory : NagApiFactory;

    /// <summary>
    /// Registers a device + account, optionally upgrading it to a Clerk
    /// identity, and returns an authed client (Bearer = device token).
    /// </summary>
    private async Task<(Guid AccountId, Guid DeviceId, HttpClient Client)> RegisterDeviceAsync(
        string? upgradeSub = null
    )
    {
        var client = _factory.CreateClient();
        var deviceId = Guid.NewGuid();
        var resp = await client.PostAsJsonAsync(
            "/devices",
            new RegisterDeviceRequest(deviceId, "test")
        );
        resp.StatusCode.ShouldBe(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<RegisterDeviceResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            body!.DeviceToken
        );

        if (upgradeSub is not null)
        {
            _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(upgradeSub);
            var up = await client.PostAsJsonAsync(
                "/accounts/me/identity",
                new SetAccountIdentityRequest("any-token")
            );
            up.StatusCode.ShouldBe(HttpStatusCode.Created);
        }

        return (body.AccountId, body.DeviceId, client);
    }

    [Fact]
    public async Task unregisters_a_device_and_returns_204()
    {
        var (_, _, client) = await RegisterDeviceAsync(upgradeSub: $"user_{Guid.NewGuid():N}");

        var response = await client.DeleteAsync("/devices/me");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task unregistering_the_last_device_cascades_to_account_delete()
    {
        var sub = $"user_{Guid.NewGuid():N}";
        var (accountId, _, client) = await RegisterDeviceAsync(upgradeSub: sub);

        (await client.DeleteAsync("/devices/me")).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        // The account row must be gone — no orphan account left bound to the
        // freed Clerk identity.
        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        var account = await session.LoadAsync<Account>(accountId);
        account.ShouldBeNull();

        // Pair on the same sub should now 404 — the identity is fully freed.
        var anonClient = _factory.CreateClient();
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);
        var pair = await anonClient.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(Guid.NewGuid(), "any-token", null)
        );
        pair.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task unregistering_one_of_several_devices_leaves_the_account_intact()
    {
        var sub = $"user_{Guid.NewGuid():N}";
        var (accountId, _, primaryClient) = await RegisterDeviceAsync(upgradeSub: sub);

        // Pair a second device onto the same account so the unregister
        // doesn't cascade.
        var secondDeviceId = Guid.NewGuid();
        var anonClient = _factory.CreateClient();
        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);
        var pair = await anonClient.PostAsJsonAsync(
            "/accounts/me/devices",
            new PairDeviceRequest(secondDeviceId, "any-token", "second")
        );
        pair.StatusCode.ShouldBe(HttpStatusCode.Created);
        var paired = await pair.Content.ReadFromJsonAsync<PairDeviceResponse>();
        paired!.AccountId.ShouldBe(accountId);

        // Unregister the original device.
        (await primaryClient.DeleteAsync("/devices/me")).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );

        // Account and the second device must still be present.
        using var scope = _factory.Services.CreateScope();
        var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
        var account = await session.LoadAsync<Account>(accountId);
        account.ShouldNotBeNull();
        account!.IdpSubject.ShouldBe(sub);
        var second = await session.LoadAsync<Device>(secondDeviceId);
        second.ShouldNotBeNull();
        second!.AccountId.ShouldBe(accountId);
    }

    [Fact]
    public async Task retrying_after_a_successful_unregister_returns_401()
    {
        // Documents the post-unregister state: the device token signed
        // (accountId, deviceId) is no longer valid — for the cascade case
        // the account row is gone, for the multi-device case the device
        // row is gone — and the auth handler rejects the bearer before
        // the endpoint runs. The client should treat 401 on a retry as
        // "already done" rather than a real failure.
        var (_, _, client) = await RegisterDeviceAsync(upgradeSub: $"user_{Guid.NewGuid():N}");

        (await client.DeleteAsync("/devices/me")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.DeleteAsync("/devices/me")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task unauthenticated_returns_401()
    {
        var client = _factory.CreateClient();

        var response = await client.DeleteAsync("/devices/me");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task re_registering_after_a_cascade_creates_a_fresh_account()
    {
        // The "start a new account" branch of the sign-in conflict flow:
        // the app calls DELETE /devices/me to fully release the previous
        // identity binding, then re-registers under the same deviceId.
        // Because the cascade dropped the old Device row, the next
        // POST /devices produces a brand-new account — no
        // collision with the (now-deleted) previous account.
        var sub = $"user_{Guid.NewGuid():N}";
        var (oldAccountId, deviceId, client) = await RegisterDeviceAsync(upgradeSub: sub);

        (await client.DeleteAsync("/devices/me")).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var anonClient = _factory.CreateClient();
        var resp = await anonClient.PostAsJsonAsync(
            "/devices",
            new RegisterDeviceRequest(deviceId, null)
        );
        resp.StatusCode.ShouldBe(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<RegisterDeviceResponse>();
        body!.AccountId.ShouldNotBe(oldAccountId);
        body.DeviceId.ShouldBe(deviceId);
    }
}
#endif
