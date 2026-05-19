using FluentValidation;
using MediApp.Api.Aplicacion.Lecturas;
using MediApp.Api.Common;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Infraestructura.Almacen;
using MediApp.Api.Features.Lecturas;

namespace MediApp.Api.API.Features.Lecturas;

public static class LecturasEndpoints
{
    public static RouteGroupBuilder MapLecturasEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/lecturas — sync desde mobile
        grupo.MapPost("/", async (
            SyncRequest<LecturaPayload> req,
            IValidator<LecturaPayload> validator,
            SyncHandler handler,
            IRepositorioEntidad<Lectura> repositorio,
            IRepositorioSyncRegistro syncRegistros,
            IAlmacenEvidencias almacen,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("LecturasEndpoints");

            int idMedidorResuelto = 0;

            return await handler.HandleAsync<LecturaPayload, Lectura>(
                req,
                validator,
                repositorio,
                p => LecturaMapper.PayloadAEntidad(p, idMedidorResuelto),
                (p, e) => LecturaMapper.AplicarPayload(p, e, idMedidorResuelto),
                e => e.Id,
                fkExistsCheck: async p =>
                {
                    var sync = await syncRegistros.BuscarPorClienteYTipoAsync(p.IdMedidorCliente, "medidor", ct);
                    if (sync is null)
                        return (false, $"FK orphan: medidor '{p.IdMedidorCliente}' no encontrado en server.");
                    idMedidorResuelto = sync.IdEntidad;
                    return (true, string.Empty);
                },
                tipo: "lectura",
                logger,
                ct,
                preProcess: async (p, ct2) =>
                {
                    if (!string.IsNullOrEmpty(p.EvidenciaFotoBase64) && !string.IsNullOrEmpty(p.EvidenciaFotoMime))
                    {
                        p.EvidenciaFotoRutaResuelta = await almacen.GuardarAsync(
                            req.IdCliente, p.EvidenciaFotoBase64!, p.EvidenciaFotoMime!, ct2);
                    }
                });
        });

        // GET /api/v1/lecturas — listado para el dashboard
        grupo.MapGet("/", async (IServicioLecturas servicio, CancellationToken ct) =>
        {
            var lista = await servicio.ListarAsync(ct);
            return Results.Ok(lista.Select(l => new
            {
                l.Id,
                l.Periodo,
                l.LecturaActual,
                l.LecturaAnterior,
                ConsumoM3 = l.LecturaActual - l.LecturaAnterior,
                l.TimestampCaptura,
                l.Observaciones,
                l.EvidenciaFotoRuta,
                NumeroMedidor = l.Medidor != null ? l.Medidor.NumeroMedidor : null,
                NombreSuscriptor = l.Medidor != null && l.Medidor.Suscriptor != null
                    ? l.Medidor.Suscriptor.NombreApellidos
                    : null,
            }));
        });

        return grupo;
    }
}
