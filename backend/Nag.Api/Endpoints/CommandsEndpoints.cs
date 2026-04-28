using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class CommandsEndpoints
{
    [Tags("Commands")]
    [EndpointName("postCommands")]
    [ProducesResponseType(typeof(CommandAccepted), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [WolverinePost("/commands")]
    public static async Task<IResult> PostCommand(
        CommandEnvelope envelope,
        CommandDispatcher dispatcher,
        CancellationToken ct
    )
    {
        if (envelope.Id == Guid.Empty)
            return Results.BadRequest(new ErrorResponse(["envelope.id is required"]));

        object? command;
        try
        {
            if (
                !CommandRegistry.TryDeserialize(
                    envelope.Type,
                    envelope.Payload,
                    NagJsonOptions.Default,
                    out command
                )
            )
            {
                return Results.BadRequest(
                    new ErrorResponse([$"Unknown command type: {envelope.Type}"])
                );
            }
        }
        catch (JsonException ex)
        {
            // Payload JSON is well-formed at the envelope level (otherwise
            // the request wouldn't have gotten here) but fails to bind to
            // the command record — e.g. payload.habitId is not a Guid.
            // Translate to a 400 so the client halts this command rather
            // than treating it as a transient 5xx and retrying forever.
            return Results.BadRequest(
                new ErrorResponse([$"Invalid payload for {envelope.Type}: {ex.Message}"])
            );
        }

        var result = await dispatcher.DispatchAsync(envelope.Id, command!, ct);
        return result.Outcome switch
        {
            DispatchOutcome.Accepted => Results.Ok(new CommandAccepted(true, result.Sequence)),
            DispatchOutcome.Duplicate => Results.Ok(new CommandAccepted(false, result.Sequence)),
            DispatchOutcome.Invalid => Results.BadRequest(new ErrorResponse(result.Errors)),
            _ => Results.StatusCode(500),
        };
    }
}
