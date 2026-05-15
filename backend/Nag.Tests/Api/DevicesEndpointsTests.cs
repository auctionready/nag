using System.Net;
using System.Net.Http.Json;
using Nag.Core.Contracts;
using Nag.Tests.Infrastructure;
using Shouldly;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class DevicesEndpointsTests : IClassFixture<DevicesEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public DevicesEndpointsTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_devices";
    }

    public sealed class Factory : NagApiFactory;

    [Fact]
    public async Task registers_a_new_device_and_creates_an_anonymous_account()
    {
        var client = _factory.CreateClient();
        var deviceId = Guid.NewGuid();

        var response = await client.PostAsJsonAsync(
            "/devices/register",
            new RegisterDeviceRequest(deviceId, "Pixel 9")
        );

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        response.Headers.Location!.ToString().ShouldBe($"/devices/{deviceId}");
        var result = await response.Content.ReadFromJsonAsync<RegisterDeviceResponse>();
        result.ShouldNotBeNull();
        result!.DeviceId.ShouldBe(deviceId);
        result.AccountId.ShouldNotBe(Guid.Empty);
        result.DeviceToken.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task re_registering_the_same_device_id_returns_the_existing_account()
    {
        var client = _factory.CreateClient();
        var deviceId = Guid.NewGuid();

        var firstResponse = await client.PostAsJsonAsync(
            "/devices/register",
            new RegisterDeviceRequest(deviceId, null)
        );
        var first = await firstResponse.Content.ReadFromJsonAsync<RegisterDeviceResponse>();

        var secondResponse = await client.PostAsJsonAsync(
            "/devices/register",
            new RegisterDeviceRequest(deviceId, "renamed")
        );
        var second = await secondResponse.Content.ReadFromJsonAsync<RegisterDeviceResponse>();

        secondResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        secondResponse.Content.Headers.ContentLocation!.ToString().ShouldBe($"/devices/{deviceId}");
        second.ShouldNotBeNull();
        second!.AccountId.ShouldBe(first!.AccountId);
        second.DeviceId.ShouldBe(first.DeviceId);
        second.RegisteredAt.ShouldBe(first.RegisteredAt);
        second.DeviceToken.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task two_distinct_devices_get_distinct_accounts()
    {
        var client = _factory.CreateClient();

        var a = await (
            await client.PostAsJsonAsync(
                "/devices/register",
                new RegisterDeviceRequest(Guid.NewGuid(), null)
            )
        ).Content.ReadFromJsonAsync<RegisterDeviceResponse>();

        var b = await (
            await client.PostAsJsonAsync(
                "/devices/register",
                new RegisterDeviceRequest(Guid.NewGuid(), null)
            )
        ).Content.ReadFromJsonAsync<RegisterDeviceResponse>();

        a.ShouldNotBeNull();
        b.ShouldNotBeNull();
        a!.AccountId.ShouldNotBe(b!.AccountId);
        a.DeviceToken.ShouldNotBe(b.DeviceToken);
    }

    [Fact]
    public async Task missing_device_id_returns_400()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/devices/register",
            new RegisterDeviceRequest(Guid.Empty, null)
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
