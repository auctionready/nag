#if DEBUG
using Microsoft.OpenApi.Models;
using Nag.Core.Contracts;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Nag.Api.Endpoints;

/// <summary>
/// Builds a discriminated union for command envelopes: each variant fixes
/// <c>type</c> to a const string and <c>payload</c> to the matching command schema.
/// </summary>
public sealed class CommandSchemasFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        var variants = new List<(string name, OpenApiSchema payloadRef)>();
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
        List<(string name, OpenApiSchema payloadRef)> variants
    )
    {
        if (!doc.Components.Schemas.TryGetValue(schemaName, out var envelope))
            return;

        // Build a named variant schema for each command type.
        // E.g. CommandEnvelope_CreateHabit with type=const "CreateHabit" and payload=$ref CreateHabit.
        var variantRefs = new List<OpenApiSchema>();
        var mapping = new Dictionary<string, string>();

        foreach (var (name, payloadRef) in variants)
        {
            var variantName = $"{schemaName}_{name}";

            // Copy shared properties (id, timestamp, etc.) from the base envelope
            var variantProps = new Dictionary<string, OpenApiSchema>();
            var required = new HashSet<string>();
            if (envelope.Properties is not null)
            {
                foreach (var (propName, propSchema) in envelope.Properties)
                {
                    if (propName == "type" || propName == "payload")
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
                Type = "string",
                Enum = [new Microsoft.OpenApi.Any.OpenApiString(name)],
            };
            required.Add("type");

            // Typed payload
            variantProps["payload"] = payloadRef;
            required.Add("payload");

            var variantSchema = new OpenApiSchema
            {
                Type = "object",
                Properties = variantProps,
                Required = required,
            };

            doc.Components.Schemas[variantName] = variantSchema;
            variantRefs.Add(
                new OpenApiSchema
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.Schema,
                        Id = variantName,
                    },
                }
            );
            mapping[name] = $"#/components/schemas/{variantName}";
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
