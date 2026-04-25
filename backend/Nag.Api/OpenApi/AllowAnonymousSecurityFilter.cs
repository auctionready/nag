#if DEBUG
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.OpenApi;

/// <summary>
/// Applies the global <c>Bearer</c> security requirement to every
/// operation that does not carry <c>[AllowAnonymous]</c> metadata. The
/// security scheme itself is registered in <c>AddSwaggerGen</c> via
/// <c>AddSecurityDefinition("Bearer", ...)</c>.
/// </summary>
public sealed class AllowAnonymousSecurityFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var anonymous = context
            .ApiDescription.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>()
            .Any();
        if (anonymous)
            return;

        operation.Security =
        [
            new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer")] = new List<string>(),
            },
        ];
    }
}
#endif
