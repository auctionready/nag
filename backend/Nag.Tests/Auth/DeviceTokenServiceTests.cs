using Microsoft.Extensions.Options;
using Nag.Api.Auth;
using Shouldly;

namespace Nag.Tests.Auth;

public class DeviceTokenServiceTests
{
    private static DeviceTokenService NewService(
        string secret = "test-secret-0123456789abcdef",
        TimeProvider? clock = null,
        TimeSpan? lifetime = null
    )
    {
        var options = Options.Create(
            new DeviceTokenOptions { Secret = secret, Lifetime = lifetime ?? TimeSpan.FromHours(1) }
        );
        return new DeviceTokenService(options, clock ?? TimeProvider.System);
    }

    [Fact]
    public void round_trip_recovers_account_and_device_ids()
    {
        var svc = NewService();
        var accountId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();

        var token = svc.Issue(accountId, deviceId);
        var result = svc.Validate(token);

        result.Ok.ShouldBeTrue();
        result.AccountId.ShouldBe(accountId);
        result.DeviceId.ShouldBe(deviceId);
    }

    [Fact]
    public void issued_token_has_exactly_one_dot()
    {
        var svc = NewService();
        var token = svc.Issue(Guid.NewGuid(), Guid.NewGuid());
        token.Count(c => c == '.').ShouldBe(1);
    }

    [Fact]
    public void expired_token_is_rejected()
    {
        var fake = new FakeClock(DateTimeOffset.UtcNow);
        var svc = NewService(clock: fake, lifetime: TimeSpan.FromMinutes(5));
        var token = svc.Issue(Guid.NewGuid(), Guid.NewGuid());

        fake.Advance(TimeSpan.FromMinutes(10));
        var result = svc.Validate(token);

        result.Ok.ShouldBeFalse();
        result.FailureReason!.ShouldContain("expired");
    }

    [Fact]
    public void tampered_signature_is_rejected()
    {
        var svc = NewService();
        var token = svc.Issue(Guid.NewGuid(), Guid.NewGuid());
        // Flip a character in the middle of the signature, not the last one.
        // The HMAC is 32 bytes → 43 base64url chars (1 padding char stripped),
        // so the final char only carries 2 significant bits. Swapping 'A' (0)
        // for 'B' (1) there can decode to the same bytes, making the test
        // flaky. A mid-signature flip always changes a fully-significant char.
        var dot = token.IndexOf('.');
        var mid = dot + (token.Length - dot) / 2;
        var tampered = string.Create(
            token.Length,
            (token, mid),
            static (span, state) =>
            {
                state.token.CopyTo(span);
                span[state.mid] = span[state.mid] == 'A' ? 'B' : 'A';
            }
        );

        var result = svc.Validate(tampered);

        result.Ok.ShouldBeFalse();
        result.FailureReason.ShouldNotBeNullOrEmpty();
    }

    [Fact]
    public void rotated_secret_invalidates_old_tokens()
    {
        var token = NewService(secret: "secret-A").Issue(Guid.NewGuid(), Guid.NewGuid());

        var result = NewService(secret: "secret-B").Validate(token);

        result.Ok.ShouldBeFalse();
        result.FailureReason.ShouldNotBeNullOrEmpty();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-token")]
    [InlineData("missing.dot.too.many")]
    [InlineData("@#%.$%^")]
    public void malformed_tokens_are_rejected(string token)
    {
        var svc = NewService();
        svc.Validate(token).Ok.ShouldBeFalse();
    }

    [Fact]
    public void empty_secret_throws_at_construction()
    {
        Should.Throw<InvalidOperationException>(() => NewService(secret: ""));
    }

    private sealed class FakeClock : TimeProvider
    {
        private DateTimeOffset _now;

        public FakeClock(DateTimeOffset start) => _now = start;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan delta) => _now = _now.Add(delta);
    }
}
