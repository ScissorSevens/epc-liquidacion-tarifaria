using FluentValidation;
using MediApp.Api.Common;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Features.Liquidaciones;

public static class LiquidacionesEndpoints
{
    public static RouteGroupBuilder MapLiquidacionesEndpoints(this RouteGroupBuilder grupo)
    {
        grupo.MapPost("/", async (
            SyncRequest<LiquidacionPayload> req,
            IValidator<LiquidacionPayload> validator,
            MediAppDbContext db,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("LiquidacionesEndpoints");

            int idLecturaResuelto = 0;

            return await SyncHandler.Handle<LiquidacionPayload, Liquidacion>(
                req,
                validator,
                p => LiquidacionMapper.PayloadAEntidad(p, idLecturaResuelto),
                (p, e) => LiquidacionMapper.AplicarPayload(p, e, idLecturaResuelto),
                e => e.Id,
                fkExistsCheck: async p =>
                {
                    var sync = await db.SyncRegistros
                        .FirstOrDefaultAsync(sr => sr.Tipo == "lectura"
                            && sr.IdCliente == p.IdLecturaCliente, ct);
                    if (sync is null)
                    {
                        return (false, $"FK orphan: lectura '{p.IdLecturaCliente}' no encontrada en server.");
                    }
                    idLecturaResuelto = sync.IdEntidad;
                    return (true, string.Empty);
                },
                tipo: "liquidacion",
                db,
                logger,
                ct);
        });

        // GET /api/v1/liquidaciones — listado para el dashboard
        grupo.MapGet("/", async (MediAppDbContext db, CancellationToken ct) =>
        {
            var lista = await db.Liquidaciones
                .Include(liq => liq.Lectura)
                    .ThenInclude(l => l!.Medidor)
                        .ThenInclude(m => m!.Suscriptor)
                .OrderByDescending(liq => liq.Id)
                .Select(liq => new
                {
                    liq.Id,
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
                })
                .ToListAsync(ct);
            return Results.Ok(lista);
        });

        return grupo;
    }
}
