using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Nag.Api.Auth;
using Nag.Core.Domain;
using Nag.Tests.Infrastructure;
using Shouldly;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class AuthTests : IClassFixture<AuthTests.Factory>
{
    private readonly Factory _factory;

    public AuthTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_auth";
    }

    public sealed class Factory : NagApiFactory;

    [Fact]
    public async Task missing_authorization_returns_401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/home-board");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task malformed_bearer_returns_401()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            "not-a-real-token"
        );
        var response = await client.GetAsync("/home-board");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task tampered_device_token_returns_401()
    {
        var token = _factory.IssueDeviceToken();
        var tampered = token[..^1] + (token[^1] == 'A' ? 'B' : 'A');

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            tampered
        );
        var response = await client.GetAsync("/home-board");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task valid_device_token_returns_200()
    {
        var client = _factory.CreateAuthedClient();
        var response = await client.GetAsync("/home-board");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task valid_clerk_token_returns_200()
    {
        // Seed an upgraded account so the resolver can map sub → accountId.
        const string sub = "user_clerk_auth_test";
        var accountId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var session = scope.ServiceProvider.GetRequiredService<IDocumentSession>();
            session.Store(
                new Account
                {
                    Id = accountId,
                    CreatedAt = DateTimeOffset.UtcNow,
                    IdpSubject = sub,
                    UpgradedAt = DateTimeOffset.UtcNow,
                }
            );
            await session.SaveChangesAsync();
        }

        _factory.ClerkVerifier.Behavior = _ => ClerkTokenVerificationResult.Success(sub);

        var client = _factory.CreateClient();
        // Any JWT-shaped string (two dots) — the stub verifier ignores the
        // contents and the real handler trusts the verifier.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            "header.payload.signature"
        );
        var response = await client.GetAsync("/home-board");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task clerk_token_with_no_bound_account_returns_401()
    {
        _factory.ClerkVerifier.Behavior = _ =>
            ClerkTokenVerificationResult.Success("user_with_no_account");

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            "header.payload.signature"
        );
        var response = await client.GetAsync("/home-board");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task health_endpoint_skips_auth()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task device_register_is_anonymous()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/devices/register",
            new { deviceId = Guid.NewGuid(), label = "anon" }
        );
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
