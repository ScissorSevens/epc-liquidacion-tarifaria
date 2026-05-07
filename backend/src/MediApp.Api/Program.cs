using FluentValidation;
using MediApp.Api.Features.Lecturas;
using MediApp.Api.Features.Liquidaciones;
using MediApp.Api.Features.Medidores;
using MediApp.Api.Features.Suscriptores;
using MediApp.Api.Infrastructure.Almacen;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Formatting.Compact;

// Bootstrap logger: captura errores tempranos antes de que el host termine de armarse.
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(new CompactJsonFormatter())
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Serilog tomado desde configuración + servicios DI; salida JSON compact a consola.
    builder.Host.UseSerilog((ctx, services, cfg) => cfg
        .ReadFrom.Configuration(ctx.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console(new CompactJsonFormatter()));

    // EF Core + Npgsql + naming convention snake_case.
    builder.Services.AddDbContext<MediAppDbContext>(opt => opt
        .UseNpgsql(builder.Configuration.GetConnectionString("Default"))
        .UseSnakeCaseNamingConvention());

    // Swagger / OpenAPI (solo se expone en Development).
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();

    // ProblemDetails RFC 7807 unificado para excepciones no atrapadas y status codes.
    builder.Services.AddProblemDetails();

    // Validators de FluentValidation registrados a mano (un Scoped por feature).
    builder.Services.AddScoped<IValidator<SuscriptorPayload>, SuscriptorValidator>();
    builder.Services.AddScoped<IValidator<MedidorPayload>, MedidorValidator>();
    builder.Services.AddScoped<IValidator<LecturaPayload>, LecturaValidator>();
    builder.Services.AddScoped<IValidator<LiquidacionPayload>, LiquidacionValidator>();

    // Almacén de evidencias fotográficas (Lectura). Singleton: stateless, lee config en el ctor.
    builder.Services.AddSingleton<IAlmacenEvidencias, AlmacenLocal>();

    // Healthcheck con ping a la DB (reemplaza el handler manual mínimo del Día 1).
    builder.Services.AddHealthChecks().AddDbContextCheck<MediAppDbContext>("postgres");

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseExceptionHandler();
    app.UseStatusCodePages();

    app.UseSerilogRequestLogging();

    // Health endpoint con AddDbContextCheck (responde 200 + status JSON, 503 si DB no responde).
    app.MapHealthChecks("/health");

    // Endpoints de sync por tipo (protocolo #213).
    app.MapGroup("/api/v1/suscriptores").MapSuscriptoresEndpoints();
    app.MapGroup("/api/v1/medidores").MapMedidoresEndpoints();
    app.MapGroup("/api/v1/lecturas").MapLecturasEndpoints();
    app.MapGroup("/api/v1/liquidaciones").MapLiquidacionesEndpoints();

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    // HostAbortedException la lanzan EF tools (migrations add/database update) a propósito
    // tras inspeccionar servicios; NO es un error real y la silenciamos.
    Log.Fatal(ex, "La API terminó inesperadamente durante el bootstrap.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

/// <summary>
/// Marker público para que WebApplicationFactory&lt;Program&gt; (Microsoft.AspNetCore.Mvc.Testing)
/// pueda referenciar el entry point del top-level Program.cs.
/// </summary>
public partial class Program;
