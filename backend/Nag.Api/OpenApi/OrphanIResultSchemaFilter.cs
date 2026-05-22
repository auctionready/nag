#if DEBUG
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.OpenApi;

/// <summary>
/// Drops the orphan <c>IResult</c> schema that Wolverine leaves behind.
///
/// Wolverine's <c>HttpChain.EndpointBuilder.establishResourceTypeMetadata</c>
/// reads the method's first <c>Creates</c> variable as the resource type — for
/// a <c>Task&lt;IResult&gt;</c> signature that's <c>IResult</c>. Since
/// <c>IResult</c> isn't an <c>IEndpointMetadataProvider</c>, Wolverine falls
/// through to its catch-all and registers
/// <c>Produces(200, typeof(IResult), "application/json")</c>, which makes
/// Swashbuckle generate a schema component for <c>IResult</c>.
/// <see cref="UndeclaredResponseFilter"/> strips the 200 entry off each
/// operation; this filter removes the now-unreferenced schema component so it
/// doesn't show up in the OpenAPI document.
/// </summary>
public sealed class OrphanIResultSchemaFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        swaggerDoc.Components?.Schemas?.Remove("IResult");
    }
}
#endif
