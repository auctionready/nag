// Opts this assembly into JasperFx.Events.SourceGenerator's compile-time
// dispatch emit. Without it, Marten 9 throws "No source-generated dispatcher
// found" at registration time because Apply/Create handlers on partial
// projection classes never get a [GeneratedEvolver] emitted.
[assembly: JasperFx.JasperFxAssembly]
