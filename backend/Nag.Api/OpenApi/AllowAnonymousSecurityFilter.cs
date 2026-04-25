#if DEBUG
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.OpenApi;

/// <summary>
/// Clears the global Bearer security requirement on operations marked
/// <c>[AllowAnonymous]</c>. The global requirement itself is added in
/// <c>Program.cs</c> via <c>c.AddSecurityRequirement(...)</c> — that
/// path resolves the security-scheme reference against the document,
/// which an operation filter can't do (no host-document access).
/// Setting <see cref="OpenApiOperation.Security"/> to an empty list
/// here overrides the global per-operation per the OpenAPI spec.
/// </summary>
public sealed class AllowAnonymousSecurityFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var anonymous = context
            .ApiDescription.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>()
            .Any();
        if (anonymous)
        {
            operation.Security = new List<OpenApiSecurityRequirement>();
        }
    }
}
#endif
