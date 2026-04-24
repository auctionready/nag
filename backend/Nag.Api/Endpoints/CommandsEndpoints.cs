using Microsoft.AspNetCore.Mvc;
using Nag.Core.Contracts;
using Nag.Core.Handlers;

namespace Nag.Api.Endpoints;

public static class CommandsEndpoints
{
    public static void MapCommandsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commands").WithTags("Commands");

        group.MapPost("/", PostCommand);
        group.MapGet("/", GetCommands);
    }

    public static async Task<IResult> PostCommand(
        CommandEnvelope envelope,
        CommandDispatcher dispatcher,
        IConfiguration _,
        CancellationToken ct
    )
    {
        if (envelope.Id == Guid.Empty)
        {
            return Results.BadRequest(new { errors = new[] { "envelope.id is required" } });
        }

        if (
            !CommandRegistry.TryDeserialize(
                envelope.Type,
                envelope.Payload,
                NagJsonOptions.Default,
                out var command
            )
        )
        {
            return Results.BadRequest(
                new { errors = new[] { $"Unknown command type: {envelope.Type}" } }
            );
        }

        var result = await dispatcher.DispatchAsync(envelope.Id, command!, ct);
        return result.Outcome switch
        {
            DispatchOutcome.Accepted => Results.Ok(new CommandAccepted(true, result.Sequence)),
            DispatchOutcome.Duplicate => Results.Ok(new CommandAccepted(false, result.Sequence)),
            DispatchOutcome.Invalid => Results.BadRequest(new { errors = result.Errors }),
            _ => Results.StatusCode(500),
        };
    }

    public static async Task<IResult> GetCommands(
        [FromQuery] long since,
        [FromQuery] int? limit,
        CommandsReader reader,
        CancellationToken ct
    )
    {
        var page = await reader.ReadSinceAsync(since, limit, ct);
        return Results.Ok(page);
    }
}
