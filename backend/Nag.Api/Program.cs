using FluentValidation;
using JasperFx.Events.Projections;
using Marten;
using Nag.Api.Auth;
using Nag.Api.Endpoints;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Nag.Core.Projections;
using Nag.Core.Validation;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog(
    (ctx, lc) =>
        lc
            .ReadFrom.Configuration(ctx.Configuration)
            .Enrich.FromLogContext()
            .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter())
);

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddSingleton(NagJsonOptions.Default);
builder.Services.ConfigureHttpJsonOptions(opts =>
{
    foreach (var c in NagJsonOptions.Default.Converters)
        opts.SerializerOptions.Converters.Add(c);
    opts.SerializerOptions.DefaultIgnoreCondition = NagJsonOptions.Default.DefaultIgnoreCondition;
});

builder.Services.AddSingleton(TimeProvider.System);

var connectionString =
    builder.Configuration.GetConnectionString("Nag")
    ?? throw new InvalidOperationException("ConnectionStrings:Nag is not configured.");

var schemaName = builder.Configuration["Nag:SchemaName"];

builder.Services.AddMarten(opts =>
{
    opts.Connection(connectionString);
    if (!string.IsNullOrWhiteSpace(schemaName))
    {
        opts.DatabaseSchemaName = schemaName;
        opts.Events.DatabaseSchemaName = schemaName;
    }
    opts.Events.StreamIdentity = JasperFx.Events.StreamIdentity.AsGuid;

    foreach (var t in CommandRegistry.All)
    {
        opts.Events.AddEventType(t);
    }

    opts.Projections.Add<HomeBoardProjection>(ProjectionLifecycle.Inline);
});

builder.Services.AddScoped<CommandDispatcher>();
builder.Services.AddScoped<CommandsReader>();

builder.Services.AddValidatorsFromAssemblyContaining<CreateHabitValidator>();

#if DEBUG
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
#endif

var app = builder.Build();

app.UseSerilogRequestLogging();

app.UseMiddleware<BearerKeyMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("Health");
app.MapCommandsEndpoints();
app.MapHomeBoardEndpoints();

#if DEBUG
app.UseSwagger();
app.UseSwaggerUI();
#endif

app.Run();

public partial class Program;
