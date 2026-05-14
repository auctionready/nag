using FluentValidation;
using JasperFx;
using Nag.Api.Auth;
using Nag.Api.Configuration;
using Nag.Api.Infrastructure;
using Nag.Core.Validation;
using Serilog;
using Wolverine.Http;
#if DEBUG
using Nag.Api.OpenApi;

dotenv.net.DotEnv.Load(
    new dotenv.net.DotEnvOptions(envFilePaths: [".env", ".env.local"], ignoreExceptions: true)
);
#endif

var builder = WebApplication.CreateBuilder(args);

LambdaSecrets.HydrateFromEnvironment(builder.Configuration);

builder.AddNagSentry();
builder.AddNagSerilog();

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddNagJson();
builder.Services.AddNagResponseCompression();
builder.Services.AddSingleton(TimeProvider.System);

builder.AddNagMarten();
builder.AddNagWolverine();
builder.AddNagAuthentication();

builder.Services.AddValidatorsFromAssemblyContaining<HabitCreatedValidator>(filter: result =>
    result.ValidatorType != typeof(ScheduleEntryValidator)
);

#if DEBUG
builder.Services.AddNagSwagger();
#endif

var app = builder.Build();

// Register Sentry's performance-monitoring middleware. Distributed-trace
// headers (`sentry-trace`, `baggage`) sent by the mobile client are picked
// up here so backend spans nest under the originating mobile transaction.
app.UseSentryTracing();

app.UseSerilogRequestLogging();

#if DEBUG
// Swagger middleware must run before UseAuthentication / UseAuthorization,
// so the docs UI is reachable without a bearer. The injected script
// pre-authorizes the UI against /dev/token, so every "Try it out" runs
// with a real HMAC-signed dev bearer.
app.UseSwagger();
app.UseSwaggerUI(c => c.UseRequestInterceptor(SwaggerDevAuth.RequestInterceptorScript));
app.MapSwaggerDevAuth();
#endif

app.UseResponseCompression();

app.UseAuthentication();
app.UseAuthorization();

app.MapWolverineEndpoints(opts =>
{
    opts.TenantId.IsClaimTypeNamed(NagClaimTypes.AccountId);
    opts.TenantId.AssertExists();
});

// JasperFx command pipeline only when explicitly opted into via env var
// (set by scripts/package-lambda.sh for `codegen write` during deploy).
// We can't gate on `args.Length > 0` because Swashbuckle's `dotnet swagger
// tofile` passes its own CLI args to Main, which would route the OpenAPI
// snapshot generation through RunJasperFxCommands and short-circuit before
// the host's endpoints are introspectable.
if (Environment.GetEnvironmentVariable("NAG_RUN_JASPERFX_COMMANDS") == "1")
{
    Environment.Exit(app.RunJasperFxCommands(args).GetAwaiter().GetResult());
}

app.Run();

namespace Nag.Api
{
    public partial class Program;
}
