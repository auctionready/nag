using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Nag.Api.Auth;
using Shouldly;

namespace Nag.Tests.Api;

public class ClerkTokenVerifierTests
{
    private const string Issuer = "https://test.clerk.accounts.dev";
    private const string OtherIssuer = "https://impostor.clerk.accounts.dev";

    public sealed class Verifying_a_token : IDisposable
    {
        private readonly RSA _rsa;
        private readonly RsaSecurityKey _key;
        private readonly ClerkTokenVerifier _verifier;
        private readonly JsonWebTokenHandler _handler = new();

        public Verifying_a_token()
        {
            _rsa = RSA.Create(2048);
            _key = new RsaSecurityKey(_rsa) { KeyId = "test-kid" };
            _verifier = MakeVerifier(Issuer, _key);
        }

        public void Dispose() => _rsa.Dispose();

        [Fact]
        public async Task succeeds_for_a_well_formed_token()
        {
            var token = MakeToken(
                _key,
                Issuer,
                subject: "user_abc",
                expiresIn: TimeSpan.FromMinutes(5)
            );

            var result = await _verifier.VerifyAsync(token, CancellationToken.None);

            result.Ok.ShouldBeTrue();
            result.Subject.ShouldBe("user_abc");
            result.Error.ShouldBeNull();
        }

        [Fact]
        public async Task fails_when_the_token_is_signed_with_a_different_key()
        {
            using var otherRsa = RSA.Create(2048);
            var otherKey = new RsaSecurityKey(otherRsa) { KeyId = "other" };
            var token = MakeToken(
                otherKey,
                Issuer,
                subject: "user_abc",
                expiresIn: TimeSpan.FromMinutes(5)
            );

            var result = await _verifier.VerifyAsync(token, CancellationToken.None);

            result.Ok.ShouldBeFalse();
            result.Subject.ShouldBeNull();
            result.Error.ShouldNotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task fails_when_the_token_has_expired()
        {
            var token = MakeToken(
                _key,
                Issuer,
                subject: "user_abc",
                expiresIn: TimeSpan.FromMinutes(-10)
            );

            var result = await _verifier.VerifyAsync(token, CancellationToken.None);

            result.Ok.ShouldBeFalse();
            result.Error!.ShouldContain("expired", Case.Insensitive);
        }

        [Fact]
        public async Task fails_when_the_issuer_does_not_match()
        {
            var token = MakeToken(
                _key,
                OtherIssuer,
                subject: "user_abc",
                expiresIn: TimeSpan.FromMinutes(5)
            );

            var result = await _verifier.VerifyAsync(token, CancellationToken.None);

            result.Ok.ShouldBeFalse();
            result.Error.ShouldNotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task fails_when_the_token_has_no_sub_claim()
        {
            var token = MakeToken(_key, Issuer, subject: null, expiresIn: TimeSpan.FromMinutes(5));

            var result = await _verifier.VerifyAsync(token, CancellationToken.None);

            result.Ok.ShouldBeFalse();
            result.Error!.ShouldContain("sub", Case.Insensitive);
        }

        [Fact]
        public async Task fails_for_an_empty_token()
        {
            var result = await _verifier.VerifyAsync("", CancellationToken.None);

            result.Ok.ShouldBeFalse();
            result.Error.ShouldNotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task fails_for_a_malformed_token()
        {
            var result = await _verifier.VerifyAsync("not.a.token", CancellationToken.None);

            result.Ok.ShouldBeFalse();
            result.Error.ShouldNotBeNullOrWhiteSpace();
        }

        private string MakeToken(
            SecurityKey signingKey,
            string issuer,
            string? subject,
            TimeSpan expiresIn
        )
        {
            // Anchor NotBefore/IssuedAt one hour before Expires so the descriptor
            // is always temporally well-formed even when the test wants the token
            // to be already-expired (negative expiresIn).
            var expires = DateTime.UtcNow + expiresIn;
            var descriptor = new SecurityTokenDescriptor
            {
                Issuer = issuer,
                Expires = expires,
                NotBefore = expires - TimeSpan.FromHours(1),
                IssuedAt = expires - TimeSpan.FromHours(1),
                SigningCredentials = new SigningCredentials(
                    signingKey,
                    SecurityAlgorithms.RsaSha256
                ),
            };
            if (subject is not null)
            {
                descriptor.Subject = new System.Security.Claims.ClaimsIdentity([
                    new System.Security.Claims.Claim("sub", subject),
                ]);
            }
            return _handler.CreateToken(descriptor);
        }
    }

    public sealed class Constructing_the_verifier
    {
        [Fact]
        public void throws_when_the_issuer_is_not_configured()
        {
            Should.Throw<InvalidOperationException>(() =>
                new ClerkTokenVerifier(
                    Options.Create(new ClerkOptions { Issuer = "" }),
                    new StubConfigManager(new OpenIdConnectConfiguration())
                )
            );
        }
    }

    private static ClerkTokenVerifier MakeVerifier(string issuer, params SecurityKey[] signingKeys)
    {
        var config = new OpenIdConnectConfiguration { Issuer = issuer };
        foreach (var key in signingKeys)
        {
            config.SigningKeys.Add(key);
        }
        return new ClerkTokenVerifier(
            Options.Create(new ClerkOptions { Issuer = issuer }),
            new StubConfigManager(config)
        );
    }

    private sealed class StubConfigManager : IConfigurationManager<OpenIdConnectConfiguration>
    {
        private readonly OpenIdConnectConfiguration _config;

        public StubConfigManager(OpenIdConnectConfiguration config) => _config = config;

        public Task<OpenIdConnectConfiguration> GetConfigurationAsync(CancellationToken cancel) =>
            Task.FromResult(_config);

        public void RequestRefresh() { }
    }
}
