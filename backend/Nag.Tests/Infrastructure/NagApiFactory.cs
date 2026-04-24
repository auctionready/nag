using Marten;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Nag.Tests.Infrastructure;

public class NagApiFactory : WebApplicationFactory<Program>
{
    public string ConnectionString { get; set; } = "";
    public string SchemaName { get; set; } = "nag_api_test";
    public string ApiKey { get; set; } = "test-api-key";

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
        });
    }
}
