#if DEBUG
using System.Text.Json.Nodes;
using Microsoft.OpenApi;
using Nag.Core.Contracts;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.OpenApi;

/// <summary>
/// Builds a discriminated union for command envelopes: each variant fixes
/// <c>type</c> to a const string and <c>payload</c> to the matching command schema.
/// </summary>
public sealed class CommandSchemasFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        var variants = new List<(string name, IOpenApiSchema payloadRef)>();
        foreach (var (name, type) in CommandRegistry.ByName)
        {
            var payloadRef = context.SchemaGenerator.GenerateSchema(type, context.SchemaRepository);
            variants.Add((name, payloadRef));
        }

        PatchEnvelope(swaggerDoc, context, nameof(CommandEnvelope), variants);
        PatchEnvelope(swaggerDoc, context, nameof(CommandEnvelopeOut), variants);
    }

    private static void PatchEnvelope(
        OpenApiDocument doc,
        DocumentFilterContext context,
        string schemaName,
        List<(string name, IOpenApiSchema payloadRef)> variants
    )
    {
        if (
            doc.Components?.Schemas is null
            || !doc.Components.Schemas.TryGetValue(schemaName, out var envelopeSchema)
        )
            return;

        if (envelopeSchema is not OpenApiSchema envelope)
            return;

        // Build a named variant schema for each command type.
        var variantRefs = new List<IOpenApiSchema>();
        var mapping = new Dictionary<string, OpenApiSchemaReference>();

        foreach (var (name, payloadRef) in variants)
        {
            var variantName = $"{schemaName}_{name}";

            // Copy shared properties (id, timestamp, etc.) from the base envelope
            var variantProps = new Dictionary<string, IOpenApiSchema>();
            var required = new HashSet<string>();
            if (envelope.Properties is not null)
            {
                foreach (var (propName, propSchema) in envelope.Properties)
                {
                    if (propName is "type" or "payload")
                        continue;
                    variantProps[propName] = propSchema;
                }
            }
            if (envelope.Required is not null)
            {
                foreach (var r in envelope.Required)
                    required.Add(r);
            }

            // Fixed type value
            variantProps["type"] = new OpenApiSchema
            {
                Type = JsonSchemaType.String,
                Enum = [JsonValue.Create(name)!],
            };
            required.Add("type");

            // Typed payload
            variantProps["payload"] = payloadRef;
            required.Add("payload");

            var variantSchema = new OpenApiSchema
            {
                Type = JsonSchemaType.Object,
                Properties = variantProps,
                Required = required,
            };

            doc.Components.Schemas[variantName] = variantSchema;
            var schemaRef = new OpenApiSchemaReference(variantName, doc);
            variantRefs.Add(schemaRef);
            mapping[name] = schemaRef;
        }

        // Replace the base envelope with a oneOf + discriminator
        envelope.Properties = null;
        envelope.Required = null;
        envelope.Type = null;
        envelope.OneOf = variantRefs;
        envelope.Discriminator = new OpenApiDiscriminator
        {
            PropertyName = "type",
            Mapping = mapping,
        };
    }
}
#endif
