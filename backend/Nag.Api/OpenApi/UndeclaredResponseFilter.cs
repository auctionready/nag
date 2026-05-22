#if DEBUG
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.OpenApi;

/// <summary>
/// Strips the bogus 200 response that references the <c>IResult</c> schema.
///
/// Wolverine's <c>HttpChain.EndpointBuilder.establishResourceTypeMetadata</c>
/// reads the method's first <c>Creates</c> as the resource type — for a
/// <c>Task&lt;IResult&gt;</c> signature that's <c>IResult</c>. Since
/// <c>IResult</c> isn't an <c>IEndpointMetadataProvider</c>, Wolverine falls
/// through to a catch-all that registers
/// <c>Produces(200, typeof(IResult), "application/json")</c> and
/// <c>Produces(404)</c>. Swashbuckle then emits a 200 whose body is
/// <c>$ref: "#/components/schemas/IResult"</c>, which is meaningless.
///
/// Targeted strip: only the 200 whose schema is the literal <c>IResult</c>
/// type. We deliberately leave the 404 alone — Wolverine adding it for
/// every <c>Task&lt;IResult&gt;</c> endpoint is reasonable (the method is
/// free to return <c>Results.NotFound()</c>), and endpoints that need
/// concrete 200s declare them explicitly via <c>[ProducesResponseType]</c>
/// which Swashbuckle prefers over Wolverine's default. Orphan
/// <c>IResult</c> schema is dropped by <see cref="OrphanIResultSchemaFilter"/>.
/// </summary>
public sealed class UndeclaredResponseFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (operation.Responses is null)
            return;

        if (operation.Responses.TryGetValue("200", out var ok) && IsIResultBody(ok))
        {
            operation.Responses.Remove("200");
        }
    }

    private static bool IsIResultBody(IOpenApiResponse response)
    {
        if (response.Content is null)
            return false;

        foreach (var media in response.Content.Values)
        {
            if (
                media.Schema is OpenApiSchemaReference reference
                && reference.Reference?.Id == "IResult"
            )
            {
                return true;
            }
        }
        return false;
    }
}
#endif
