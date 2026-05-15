using Nag.Api.Infrastructure;
using Serilog;

namespace Nag.Api.Configuration;

public static class ObservabilityExtensions
{
    extension(WebApplicationBuilder builder)
    {
        public WebApplicationBuilder AddNagSentry()
        {
            // Sentry: read all options from the `Sentry` config section. DSN comes from
            // `Sentry:Dsn` (env var `SENTRY_DSN` in Lambda, hydrated by LambdaSecrets);
            // when unset, pass an empty string to start the SDK in disabled mode (the
            // only opt-out the SDK accepts — null throws). This matters for the
            // Swashbuckle CLI host that builds the spec without any deployment config.
            builder.WebHost.UseSentry(o =>
            {
                if (string.IsNullOrWhiteSpace(o.Dsn))
                {
                    o.Dsn = string.Empty;
                }
                o.Environment ??= builder.Environment.EnvironmentName;
                // ASP.NET Core's pipeline is async, so events are queued on a
                // background worker. In Lambda the host is frozen between
                // invocations — flush the queue at the end of each request so we
                // don't lose events.
                o.FlushOnCompletedRequest = true;
                // Defense in depth: even with MaxRequestBodySize=None, scrub the
                // request body and query string on routes that carry high-value
                // secrets in the body (Clerk JWTs, admin pre-shared secret) so a
                // future config flip can't silently exfiltrate them.
                o.SetBeforeSend(SentryScrubbing.ScrubSensitiveRequests);
            });
            return builder;
        }

        public WebApplicationBuilder AddNagSerilog()
        {
            builder.Host.UseSerilog(
                (ctx, lc) =>
                {
                    lc.ReadFrom.Configuration(ctx.Configuration)
                        .Enrich.FromLogContext()
                        .WriteTo.Console() // new Serilog.Formatting.Json.JsonFormatter()
                        .WriteTo.Sentry(s =>
                        {
                            // Piggyback on the SDK already initialized by `UseSentry`
                            // above. Without this, the sink calls `SentrySdk.Init`
                            // itself and throws when no DSN is configured (e.g.
                            // `dotnet swagger tofile` builds the host without one).
                            s.InitializeSdk = false;
                            // Warning+ becomes a Sentry event; Information+ rides along
                            // as a breadcrumb on whatever event captures next.
                            s.MinimumEventLevel = Serilog.Events.LogEventLevel.Warning;
                            s.MinimumBreadcrumbLevel = Serilog.Events.LogEventLevel.Information;
                        });
#if DEBUG
                    // `dotnet swagger tofile` enumerates ApiExplorer, which queries MVC's
                    // descriptor provider. We use Wolverine endpoints (not MVC), so it logs
                    // a misleading "No action descriptors found" at Information level. In
                    // Release nothing enumerates ApiExplorer, so the warning never fires.
                    lc.MinimumLevel.Override(
                        "Microsoft.AspNetCore.Mvc.Infrastructure.DefaultActionDescriptorCollectionProvider",
                        Serilog.Events.LogEventLevel.Warning
                    );
#endif
                }
            );
            return builder;
        }
    }
}
