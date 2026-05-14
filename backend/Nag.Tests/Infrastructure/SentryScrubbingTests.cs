using Nag.Api.Infrastructure;
using Sentry;
using Shouldly;

namespace Nag.Tests.Infrastructure;

public class SentryScrubbingTests
{
    [Theory]
    [InlineData("https://api.example.com/accounts/upgrade")]
    [InlineData("https://api.example.com/devices/pair")]
    [InlineData("https://api.example.com/admin/rebuild-projections")]
    [InlineData("/accounts/upgrade?trace=1")]
    public void scrubs_body_and_query_for_sensitive_routes(string url)
    {
        var evt = new SentryEvent
        {
            Request =
            {
                Url = url,
                Data = new { idpToken = "eyJ..." },
                QueryString = "trace=1",
            },
        };

        SentryScrubbing.ScrubSensitiveRequests(evt);

        evt.Request.Data.ShouldBe("[scrubbed]");
        evt.Request.QueryString.ShouldBeNull();
    }

    [Fact]
    public void preserves_body_on_unrelated_routes()
    {
        var body = new { foo = "bar" };
        var evt = new SentryEvent
        {
            Request =
            {
                Url = "https://api.example.com/home-board",
                Data = body,
                QueryString = "x=1",
            },
        };

        SentryScrubbing.ScrubSensitiveRequests(evt);

        evt.Request.Data.ShouldBe(body);
        evt.Request.QueryString.ShouldBe("x=1");
    }

    [Fact]
    public void leaves_event_alone_when_url_missing()
    {
        var body = new { foo = "bar" };
        var evt = new SentryEvent { Request = { Data = body } };

        SentryScrubbing.ScrubSensitiveRequests(evt);

        evt.Request.Data.ShouldBe(body);
    }
}
