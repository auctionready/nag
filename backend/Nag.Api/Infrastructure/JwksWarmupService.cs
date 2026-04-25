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
    IConfigurationManager<OpenIdConnectConfiguration> configManager
) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _ = configManager.GetConfigurationAsync(cancellationToken);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
