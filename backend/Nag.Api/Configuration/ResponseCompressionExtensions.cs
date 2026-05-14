using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;

namespace Nag.Api.Configuration;

public static class ResponseCompressionExtensions
{
    public static IServiceCollection AddNagResponseCompression(this IServiceCollection services)
    {
        services.AddResponseCompression(opts =>
        {
            opts.EnableForHttps = true;
            opts.Providers.Add<BrotliCompressionProvider>();
            opts.Providers.Add<GzipCompressionProvider>();
            opts.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json"]);
        });
        services.Configure<BrotliCompressionProviderOptions>(o =>
            o.Level = CompressionLevel.Fastest
        );
        services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
        return services;
    }
}
