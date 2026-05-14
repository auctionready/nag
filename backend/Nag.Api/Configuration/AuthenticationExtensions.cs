using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Nag.Api.Auth;
using Nag.Api.Infrastructure;

namespace Nag.Api.Configuration;

public static class AuthenticationExtensions
{
    public static WebApplicationBuilder AddNagAuthentication(this WebApplicationBuilder builder)
    {
        // Clerk verifier — registered in both modes. When Nag:ClerkIssuer is unset
        // (mobile-only deployments), we register a no-op that always 401s, so the
        // auth handler can still construct without a missing dependency.
        var clerkIssuer = builder.Configuration["Nag:ClerkIssuer"];
        if (!string.IsNullOrWhiteSpace(clerkIssuer))
        {
            builder.Services.Configure<ClerkOptions>(opts => opts.Issuer = clerkIssuer);
            builder.Services.AddHttpClient("clerk-jwks");
            builder.Services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(sp =>
            {
                var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient("clerk-jwks");
                var metadataAddress =
                    $"{clerkIssuer.TrimEnd('/')}/.well-known/openid-configuration";
                return new ConfigurationManager<OpenIdConnectConfiguration>(
                    metadataAddress,
                    new OpenIdConnectConfigurationRetriever(),
                    new HttpDocumentRetriever(http)
                );
            });
            builder.Services.AddSingleton<IClerkTokenVerifier, ClerkTokenVerifier>();
            builder.Services.AddHostedService<JwksWarmupService>();
        }
        else
        {
            builder.Services.AddSingleton<IClerkTokenVerifier, NullClerkTokenVerifier>();
        }

        // Device-token issuance + validation (HMAC-signed envelope).
        builder.Services.Configure<DeviceTokenOptions>(
            builder.Configuration.GetSection("Nag:DeviceToken")
        );
        builder.Services.AddSingleton<DeviceTokenService>();
        builder.Services.AddSingleton<IDeviceTokenIssuer>(sp =>
            sp.GetRequiredService<DeviceTokenService>()
        );
        builder.Services.AddSingleton<IDeviceTokenValidator>(sp =>
            sp.GetRequiredService<DeviceTokenService>()
        );
        builder.Services.AddMemoryCache();
        builder.Services.AddSingleton<IDeviceAccountResolver, DeviceAccountResolver>();

        // ASP.NET Core authentication: a single "Nag" scheme whose handler
        // branches on the bearer token shape (HMAC device token vs. Clerk JWT).
        builder
            .Services.AddAuthentication(NagAuthenticationOptions.SchemeName)
            .AddScheme<NagAuthenticationOptions, NagAuthenticationHandler>(
                NagAuthenticationOptions.SchemeName,
                _ => { }
            );
        builder.Services.AddAuthorization(opts =>
        {
            // Every endpoint requires authentication unless explicitly [AllowAnonymous].
            opts.FallbackPolicy = opts.DefaultPolicy;
        });

        return builder;
    }
}
