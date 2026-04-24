using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Nag.Tests.Infrastructure;

public class NagApiFactory : WebApplicationFactory<Program>
{
    public string ConnectionString { get; set; } = "";
    public string SchemaName { get; set; } = "nag_api_test";
    public string ApiKey { get; set; } = "test-api-key";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration(
            (_, cfg) =>
            {
                cfg.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:Nag"] = ConnectionString,
                        ["Nag:ApiKey"] = ApiKey,
                        ["Nag:SchemaName"] = SchemaName,
                    }
                );
            }
        );
    }
}
