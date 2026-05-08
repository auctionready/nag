using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Nag.Api.Infrastructure;

/// <summary>
/// Pre-fetches Clerk's OpenID configuration + JWKS during host startup so
/// the first authenticated request doesn't pay the discovery + JWKS round
/// trip on a cold Lambda ENI. Runs as fire-and-forget — startup doesn't
/// block on the network call, and the cached document is ready by the
/// time the first /accounts/upgrade lands.
/// </summary>
public sealed class JwksWarmupService(
    IConfigurationManager<OpenIdConnectConfiguration> configManager,
    ILogger<JwksWarmupService> log
) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Fire-and-forget, but the task itself is observed: an unhandled
        // failure here (Clerk outage, host shutting down mid-fetch in
        // tests) would otherwise propagate via the finalizer thread as
        // an unobserved-task `AggregateException` and surface as a
        // spurious test-run crash. Warmup is best-effort — the next
        // real request will retry through the same configuration
        // manager and pay the cold-fetch latency itself.
        _ = Task.Run(
            async () =>
            {
                try
                {
                    await configManager.GetConfigurationAsync(cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    // Host stopping before warmup completes — expected.
                }
                catch (Exception ex)
                {
                    log.LogWarning(ex, "JWKS warmup failed; continuing without prefetch");
                }
            },
            cancellationToken
        );
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
