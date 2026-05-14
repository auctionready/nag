using JasperFx.CodeGeneration;
using Nag.Core.Handlers;
using Wolverine;
using Wolverine.Http;

namespace Nag.Api.Configuration;

public static class WolverineExtensions
{
    public static WebApplicationBuilder AddNagWolverine(this WebApplicationBuilder builder)
    {
        var isProduction = builder.Environment.IsProduction();

        builder.Host.UseWolverine(opts =>
        {
            opts.Durability.Mode = DurabilityMode.Serverless;
            opts.Discovery.IncludeAssembly(typeof(EventDispatcher).Assembly);

            // In production, load handler types pre-generated at build time
            // (via `codegen write`) rather than compiling them on the first invocation.
            // Cuts several seconds off Lambda cold start. Dev/test still use the
            // default dynamic mode, so unit tests don't need the pre-built assembly.
            if (isProduction)
            {
                opts.CodeGeneration.TypeLoadMode = TypeLoadMode.Static;
            }
        });

        builder.Services.AddWolverineHttp();

        builder.Services.AddScoped<EventDispatcher>();
        builder.Services.AddScoped<EventsReader>();
        builder.Services.AddScoped<SyncCoordinator>();

        return builder;
    }
}
