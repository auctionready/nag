#if DEBUG
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.Endpoints;

/// <summary>
/// Converts C# enums to camelCase string enums in the OpenAPI schema,
/// matching the <see cref="System.Text.Json.Serialization.JsonStringEnumConverter"/>
/// configured in <see cref="Nag.Core.Contracts.NagJsonOptions"/>.
/// </summary>
public sealed class EnumSchemaFilter : ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (!context.Type.IsEnum)
            return;

        if (schema is not OpenApiSchema openApiSchema)
            return;

        openApiSchema.Type = JsonSchemaType.String;
        openApiSchema.Enum = Enum.GetNames(context.Type)
            .Select(name =>
                (JsonNode)JsonValue.Create(JsonNamingPolicy.CamelCase.ConvertName(name))!
            )
            .ToList();
    }
}
#endif
