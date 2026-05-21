#if DEBUG
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.OpenApi;

/// <summary>
/// Strips the bogus <c>IResult</c> 200 response that Swashbuckle
/// auto-synthesises for endpoints returning <see cref="IResult"/>.
///
/// The endpoint methods declare <c>Task&lt;IResult&gt;</c> as the
/// return type so they can pick between <c>Results.NoContent()</c>,
/// <c>Results.NotFound()</c>, etc. at runtime. The status codes they
/// *actually* return are declared via
/// <c>[ProducesResponseType(StatusCodes.Status204NoContent)]</c> et
/// al. — but Swashbuckle still adds a default 200 with the return
/// type, which renders as <c>$ref: "#/components/schemas/IResult"</c>
/// pointing at an empty object schema and surfaces in the generated
/// Zodios client as a meaningless <c>IResult</c> export.
///
/// This filter removes that synthesised 200 whenever a 204 is
/// explicitly declared on the same operation (the unambiguous "real
/// successful response is a no-content" signal), then sweeps the
/// orphan <c>IResult</c> schema out of <c>components.schemas</c>.
/// Endpoints that genuinely return 200 with a body still have an
/// explicit <c>[ProducesResponseType(typeof(SomeBody),
/// StatusCodes.Status200OK)]</c> attribute, so this never touches
/// real responses.
/// </summary>
public sealed class RemoveIResultResponseFilter : IDocumentFilter
{
    private const string SchemaName = "IResult";

    public void Apply(OpenApiDocument document, DocumentFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(document);

        if (document.Paths is null)
            return;

        foreach (var path in document.Paths.Values)
        {
            if (path.Operations is null)
                continue;

            foreach (var op in path.Operations.Values)
            {
                if (op.Responses is null)
                    continue;

                // Only strip the synthesised 200 when there's an
                // explicit 204 on the same operation — that's the
                // signal that the real success path is no-content.
                // An endpoint that returns 200 with a body would
                // never declare 204, so we leave it alone.
                if (
                    op.Responses.TryGetValue("200", out var ok)
                    && op.Responses.ContainsKey("204")
                    && IsIResult(ok)
                )
                {
                    op.Responses.Remove("200");
                }
            }
        }

        // Once every reference is gone the schema is orphaned; drop it
        // so the generated client doesn't carry a dangling empty type.
        document.Components?.Schemas?.Remove(SchemaName);
    }

    private static bool IsIResult(IOpenApiResponse response)
    {
        if (response.Content is null)
            return false;

        foreach (var media in response.Content.Values)
        {
            if (
                media.Schema is OpenApiSchemaReference reference
                && reference.Reference?.Id == SchemaName
            )
            {
                return true;
            }
        }
        return false;
    }
}
#endif
