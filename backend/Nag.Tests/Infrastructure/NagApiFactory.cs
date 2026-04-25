using Marten;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Nag.Api.Auth;

namespace Nag.Tests.Infrastructure;

public class NagApiFactory : WebApplicationFactory<Program>
{
    public string ConnectionString { get; set; } = "";
    public string SchemaName { get; set; } = "nag_api_test";
    public string ApiKey { get; set; } = "test-api-key";

    /// <summary>
    /// Tests configure this to control what `IClerkTokenVerifier` returns.
    /// Default: rejects every token. Tests that exercise the upgrade or
    /// pair endpoints set <see cref="StubClerkTokenVerifier.Behavior"/>
    /// before issuing the request.
    /// </summary>
    public StubClerkTokenVerifier ClerkVerifier { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Nag:ApiKey", ApiKey);
        builder.UseSetting("Nag:SchemaName", SchemaName);
        builder.UseSetting("ConnectionStrings:Nag", ConnectionString);

        builder.ConfigureServices(services =>
        {
            services.PostConfigure<StoreOptions>(opts =>
            {
                opts.Connection(ConnectionString);
                if (!string.IsNullOrWhiteSpace(SchemaName))
                {
                    opts.DatabaseSchemaName = SchemaName;
                    opts.Events.DatabaseSchemaName = SchemaName;
                }
            });

            // Override the production registration (or register if Program.cs
            // skipped because Nag:ClerkIssuer wasn't set). Last registration
            // wins on `GetRequiredService<IClerkTokenVerifier>()`.
            services.AddSingleton<IClerkTokenVerifier>(ClerkVerifier);
        });
    }
}

public sealed class StubClerkTokenVerifier : IClerkTokenVerifier
{
    public Func<string, ClerkTokenVerificationResult> Behavior { get; set; } =
        _ => ClerkTokenVerificationResult.Failure("no behavior configured");

    public Task<ClerkTokenVerificationResult> VerifyAsync(string token, CancellationToken ct) =>
        Task.FromResult(Behavior(token));
}
