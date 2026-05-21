#if DEBUG
using Microsoft.OpenApi;
using Nag.Api.OpenApi;

namespace Nag.Api.Configuration;

public static class SwaggerExtensions
{
    public static IServiceCollection AddNagSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(c =>
        {
            c.UseAllOfToExtendReferenceSchemas();
            c.SchemaFilter<EnumSchemaFilter>();
            c.DocumentFilter<CommandSchemasFilter>();
            c.DocumentFilter<OrphanIResultSchemaFilter>();
            c.OperationFilter<AllowAnonymousSecurityFilter>();
            c.OperationFilter<UndeclaredResponseFilter>();
            c.AddSecurityDefinition(
                "Bearer",
                new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "Token",
                    In = ParameterLocation.Header,
                    Name = "Authorization",
                    Description =
                        "Either a per-device HMAC token (issued at POST /devices, "
                        + "POST /accounts/me/devices, or POST /accounts/me/identity) "
                        + "or a Clerk JWT.",
                }
            );
            c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
            {
                { new OpenApiSecuritySchemeReference("Bearer", doc), new List<string>() },
            });
        });
        return services;
    }
}
#endif
