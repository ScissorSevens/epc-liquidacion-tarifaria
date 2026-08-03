using FluentValidation;
using MediApp.Api.Aplicacion.Liquidaciones;
using MediApp.Api.Common;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Features.Liquidaciones;

namespace MediApp.Api.API.Features.Liquidaciones;

public static class LiquidacionesEndpoints
{
    public static RouteGroupBuilder MapLiquidacionesEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/liquidaciones — sync desde mobile
        grupo.MapPost("/", async (
            SyncRequest<LiquidacionPayload> req,
            IValidator<LiquidacionPayload> validator,
            SyncHandler handler,
            IRepositorioEntidad<Liquidacion> repositorio,
            IRepositorioSyncRegistro syncRegistros,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("LiquidacionesEndpoints");

            int idLecturaResuelto = 0;

            return await handler.HandleAsync<LiquidacionPayload, Liquidacion>(
                req,
                validator,
                repositorio,
                p => LiquidacionMapper.PayloadAEntidad(p, idLecturaResuelto),
                (p, e) => LiquidacionMapper.AplicarPayload(p, e, idLecturaResuelto),
                e => e.Id,
                fkExistsCheck: async p =>
                {
                    var sync = await syncRegistros.BuscarPorClienteYTipoAsync(p.IdLecturaCliente, "lectura", ct);
                    if (sync is null)
                        return (false, $"FK orphan: lectura '{p.IdLecturaCliente}' no encontrada en server.");
                    idLecturaResuelto = sync.IdEntidad;
                    return (true, string.Empty);
                },
                tipo: "liquidacion",
                logger,
                ct);
        });

        // GET /api/v1/liquidaciones — listado para el dashboard
        // GET /api/v1/liquidaciones?prestador_id=X — multi-tenant: filtra por prestador
        grupo.MapGet("/", async (
            IServicioLiquidaciones servicio,
            int? prestador_id,
            CancellationToken ct) =>
        {
            var lista = prestador_id.HasValue
                ? await servicio.ListarPorPrestadorAsync(prestador_id.Value, ct)
                : await servicio.ListarAsync(ct);
            return Results.Ok(lista.Select(liq => new
            {
                liq.Id,
                liq.IdPrestador,
                liq.Estrato,
                liq.ConsumoM3,
                liq.CargoFijo,
                liq.CargoBasico,
                liq.CargoExcedente,
                liq.Subsidio,
                liq.Contribucion,
                liq.Total,
                Periodo = liq.Lectura != null ? liq.Lectura.Periodo : null,
                NumeroMedidor = liq.Lectura != null && liq.Lectura.Medidor != null
                    ? liq.Lectura.Medidor.NumeroMedidor
                    : null,
                NombreSuscriptor = liq.Lectura != null && liq.Lectura.Medidor != null && liq.Lectura.Medidor.Suscriptor != null
                    ? liq.Lectura.Medidor.Suscriptor.NombreApellidos
                    : null,
            }));
        });

        return grupo;
    }
}
