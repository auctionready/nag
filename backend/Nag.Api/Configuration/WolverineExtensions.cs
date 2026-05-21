using JasperFx.CodeGeneration;
using Marten;
using Nag.Api.Auth;
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
            // default dynamic mode and pick up Roslyn via WolverineFx.RuntimeCompilation.
            if (isProduction)
            {
                opts.CodeGeneration.TypeLoadMode = TypeLoadMode.Static;
            }
            else
            {
                opts.UseRuntimeCompilation();
            }

            // Wolverine 6's `ServiceLocationPolicy.NotAllowed` default refuses to
            // codegen calls to types registered via lambda factories. Whitelist the
            // ones our handlers depend on:
            //  * IDocumentSession / IQuerySession — Marten resolves these per-request
            //    based on tenant claim (see AddMartenTenancyDetection), so they have
            //    to be lambda-registered.
            //  * IDeviceTokenIssuer / IDeviceTokenValidator — both interfaces forward
            //    to the singleton DeviceTokenService (one instance, two interfaces),
            //    a shape that can't be expressed as `AddSingleton<I, Impl>()`.
            opts.CodeGeneration.AlwaysUseServiceLocationFor<IDocumentSession>();
            opts.CodeGeneration.AlwaysUseServiceLocationFor<IQuerySession>();
            opts.CodeGeneration.AlwaysUseServiceLocationFor<IDeviceTokenIssuer>();
            opts.CodeGeneration.AlwaysUseServiceLocationFor<IDeviceTokenValidator>();
        });

        builder.Services.AddWolverineHttp();

        builder.Services.AddScoped<EventDispatcher>();
        builder.Services.AddScoped<EventsReader>();
        builder.Services.AddScoped<SyncCoordinator>();

        return builder;
    }
}
