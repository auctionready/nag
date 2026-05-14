using Nag.Core.Contracts;

namespace Nag.Api.Configuration;

public static class JsonExtensions
{
    public static IServiceCollection AddNagJson(this IServiceCollection services)
    {
        services.AddSingleton(NagJsonOptions.Default);
        services.ConfigureHttpJsonOptions(opts =>
        {
            foreach (var c in NagJsonOptions.Default.Converters)
                opts.SerializerOptions.Converters.Add(c);
            opts.SerializerOptions.DefaultIgnoreCondition = NagJsonOptions
                .Default
                .DefaultIgnoreCondition;
        });
        return services;
    }
}
