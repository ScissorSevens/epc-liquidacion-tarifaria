using FluentValidation;
using MediApp.Api.Aplicacion.Lecturas;
using MediApp.Api.Aplicacion.Liquidaciones;
using MediApp.Api.Aplicacion.Medidores;
using MediApp.Api.Aplicacion.Operarios;
using MediApp.Api.Aplicacion.Suscriptores;
using MediApp.Api.API.Features.Lecturas;
using MediApp.Api.API.Features.Liquidaciones;
using MediApp.Api.API.Features.Medidores;
using MediApp.Api.API.Features.Operarios;
using MediApp.Api.API.Features.Suscriptores;
using MediApp.Api.Common;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Features.Lecturas;
using MediApp.Api.Features.Liquidaciones;
using MediApp.Api.Features.Medidores;
using MediApp.Api.Features.Operarios;
using MediApp.Api.Features.Suscriptores;
using MediApp.Api.Infraestructura;
using MediApp.Api.Infraestructura.Almacen;
using MediApp.Api.Infraestructura.Repositorios;
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
    builder.Services.AddScoped<IValidator<OperarioPayload>, OperarioValidator>();

    // Almacén de evidencias fotográficas (Lectura). Singleton: stateless, lee config en el ctor.
    builder.Services.AddSingleton<IAlmacenEvidencias, AlmacenLocal>();

    // Repositorios de infraestructura (implementaciones EF Core de los puertos del dominio).
    builder.Services.AddScoped<IRepositorioSuscriptor, RepositorioSuscriptorEF>();
    builder.Services.AddScoped<IRepositorioMedidor, RepositorioMedidorEF>();
    builder.Services.AddScoped<IRepositorioLectura, RepositorioLecturaEF>();
    builder.Services.AddScoped<IRepositorioLiquidacion, RepositorioLiquidacionEF>();
    builder.Services.AddScoped<IRepositorioOperario, RepositorioOperarioEF>();
    builder.Services.AddScoped<IRepositorioSyncRegistro, RepositorioSyncRegistroEF>();

    // Repositorios genéricos para SyncHandler (uno por entidad sincronizable).
    builder.Services.AddScoped<IRepositorioEntidad<Suscriptor>, RepositorioEntidadEF<Suscriptor>>();
    builder.Services.AddScoped<IRepositorioEntidad<Medidor>, RepositorioEntidadEF<Medidor>>();
    builder.Services.AddScoped<IRepositorioEntidad<Lectura>, RepositorioEntidadEF<Lectura>>();
    builder.Services.AddScoped<IRepositorioEntidad<Liquidacion>, RepositorioEntidadEF<Liquidacion>>();

    // Unidad de trabajo — gestión de transacciones para SyncHandler.
    builder.Services.AddScoped<IUnitOfWork, UnitOfWorkEF>();

    // Handler de sincronización genérico (protocolo #213).
    builder.Services.AddScoped<SyncHandler>();

    // Servicios de aplicación.
    builder.Services.AddScoped<IServicioSuscriptores, ServicioSuscriptores>();
    builder.Services.AddScoped<IServicioMedidores, ServicioMedidores>();
    builder.Services.AddScoped<IServicioLecturas, ServicioLecturas>();
    builder.Services.AddScoped<IServicioLiquidaciones, ServicioLiquidaciones>();
    builder.Services.AddScoped<IServicioOperarios, ServicioOperarios>();

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

    // Sirve wwwroot/index.html (dashboard web estático, sin build/npm externo).
    app.UseStaticFiles();
    app.MapFallbackToFile("index.html");

    app.UseSerilogRequestLogging();

    // Health endpoint con AddDbContextCheck (responde 200 + status JSON, 503 si DB no responde).
    app.MapHealthChecks("/health");

    // Endpoints de sync por tipo (protocolo #213).
    app.MapGroup("/api/v1/suscriptores").MapSuscriptoresEndpoints();
    app.MapGroup("/api/v1/medidores").MapMedidoresEndpoints();
    app.MapGroup("/api/v1/lecturas").MapLecturasEndpoints();
    app.MapGroup("/api/v1/liquidaciones").MapLiquidacionesEndpoints();
    app.MapGroup("/api/v1/operarios").MapOperariosEndpoints();

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
