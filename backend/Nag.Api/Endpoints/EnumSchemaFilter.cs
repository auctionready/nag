#if DEBUG
using System.Text.Json;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.Endpoints;

/// <summary>
/// Converts C# enums to camelCase string enums in the OpenAPI schema,
/// matching the <see cref="System.Text.Json.Serialization.JsonStringEnumConverter"/>
/// configured in <see cref="Nag.Core.Contracts.NagJsonOptions"/>.
/// </summary>
public sealed class EnumSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (!context.Type.IsEnum)
            return;

        schema.Type = "string";
        schema.Enum = Enum.GetNames(context.Type)
            .Select(name =>
                (IOpenApiAny)new OpenApiString(JsonNamingPolicy.CamelCase.ConvertName(name))
            )
            .ToList();
    }
}
#endif
