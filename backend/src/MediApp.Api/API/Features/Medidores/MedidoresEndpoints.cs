using FluentValidation;
using MediApp.Api.Aplicacion.Medidores;
using MediApp.Api.Common;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Features.Medidores;

namespace MediApp.Api.API.Features.Medidores;

public static class MedidoresEndpoints
{
    public static RouteGroupBuilder MapMedidoresEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/medidores — sync desde mobile
        grupo.MapPost("/", async (
            SyncRequest<MedidorPayload> req,
            IValidator<MedidorPayload> validator,
            SyncHandler handler,
            IRepositorioEntidad<Medidor> repositorio,
            IRepositorioSyncRegistro syncRegistros,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("MedidoresEndpoints");

            int idSuscriptorResuelto = 0;

            return await handler.HandleAsync<MedidorPayload, Medidor>(
                req,
                validator,
                repositorio,
                p => MedidorMapper.PayloadAEntidad(p, idSuscriptorResuelto),
                (p, e) => MedidorMapper.AplicarPayload(p, e, idSuscriptorResuelto),
                e => e.Id,
                fkExistsCheck: async p =>
                {
                    var sync = await syncRegistros.BuscarPorClienteYTipoAsync(p.IdSuscriptorCliente, "suscriptor", ct);
                    if (sync is null)
                        return (false, $"FK orphan: suscriptor '{p.IdSuscriptorCliente}' no encontrado en server.");
                    idSuscriptorResuelto = sync.IdEntidad;
                    return (true, string.Empty);
                },
                tipo: "medidor",
                logger,
                ct);
        });

        // GET /api/v1/medidores — listado para el dashboard
        grupo.MapGet("/", async (IServicioMedidores servicio, CancellationToken ct) =>
        {
            var lista = await servicio.ListarAsync(ct);
            return Results.Ok(lista.Select(m => new
            {
                m.Id,
                m.NumeroMedidor,
                m.FechaInstalacion,
                m.Estado,
                m.Observaciones,
                m.IdSuscriptor,
                NombreSuscriptor = m.Suscriptor != null ? m.Suscriptor.NombreApellidos : null,
                CodigoSuscriptor = m.Suscriptor != null ? m.Suscriptor.Codigo : null,
            }));
        });

        return grupo;
    }
}
