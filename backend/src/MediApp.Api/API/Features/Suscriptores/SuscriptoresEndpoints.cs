using FluentValidation;
using MediApp.Api.Aplicacion.Suscriptores;
using MediApp.Api.Common;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Features.Suscriptores;

namespace MediApp.Api.API.Features.Suscriptores;

public static class SuscriptoresEndpoints
{
    public static RouteGroupBuilder MapSuscriptoresEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/suscriptores — sync desde mobile
        grupo.MapPost("/", async (
            SyncRequest<SuscriptorPayload> req,
            IValidator<SuscriptorPayload> validator,
            SyncHandler handler,
            IRepositorioEntidad<Suscriptor> repositorio,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("SuscriptoresEndpoints");
            return await handler.HandleAsync<SuscriptorPayload, Suscriptor>(
                req,
                validator,
                repositorio,
                SuscriptorMapper.PayloadAEntidad,
                SuscriptorMapper.AplicarPayload,
                e => e.Id,
                fkExistsCheck: null,
                tipo: "suscriptor",
                logger,
                ct);
        });

        // GET /api/v1/suscriptores — listado para el dashboard
        grupo.MapGet("/", async (IServicioSuscriptores servicio, CancellationToken ct) =>
        {
            var lista = await servicio.ListarAsync(ct);
            return Results.Ok(lista.Select(s => new
            {
                s.Id,
                s.Codigo,
                s.NombreApellidos,
                s.Direccion,
                s.Estrato,
                s.MatriculaInmobiliaria,
                s.NumeroCatastral,
                s.Estado,
                s.CreatedAt,
            }));
        });

        return grupo;
    }
}
