using FluentValidation;
using MediApp.Api.Common;
using MediApp.Api.Infrastructure.Almacen;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Features.Lecturas;

public static class LecturasEndpoints
{
    public static RouteGroupBuilder MapLecturasEndpoints(this RouteGroupBuilder grupo)
    {
        grupo.MapPost("/", async (
            SyncRequest<LecturaPayload> req,
            IValidator<LecturaPayload> validator,
            IAlmacenEvidencias almacen,
            MediAppDbContext db,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("LecturasEndpoints");

            // Resolución del FK al Medidor capturada en closure (similar a Medidores->Suscriptor).
            int idMedidorResuelto = 0;

            return await SyncHandler.Handle<LecturaPayload, Lectura>(
                req,
                validator,
                p => LecturaMapper.PayloadAEntidad(p, idMedidorResuelto),
                (p, e) => LecturaMapper.AplicarPayload(p, e, idMedidorResuelto),
                e => e.Id,
                fkExistsCheck: async p =>
                {
                    var sync = await db.SyncRegistros
                        .FirstOrDefaultAsync(sr => sr.Tipo == "medidor"
                            && sr.IdCliente == p.IdMedidorCliente, ct);
                    if (sync is null)
                    {
                        return (false, $"FK orphan: medidor '{p.IdMedidorCliente}' no encontrado en server.");
                    }
                    idMedidorResuelto = sync.IdEntidad;
                    return (true, string.Empty);
                },
                tipo: "lectura",
                db,
                logger,
                ct,
                // preProcess: persistir foto (si vino) y mutar payload con la ruta resuelta.
                // El handler garantiza que esto solo corre cuando hay INSERT o UPDATE forzado,
                // NUNCA en el caso 200 idempotente -> evitamos re-escribir foto idéntica.
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
        grupo.MapGet("/", async (MediAppDbContext db, CancellationToken ct) =>
        {
            var lista = await db.Lecturas
                .Include(l => l.Medidor)
                    .ThenInclude(m => m!.Suscriptor)
                .OrderByDescending(l => l.Periodo)
                .Select(l => new
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
                })
                .ToListAsync(ct);
            return Results.Ok(lista);
        });

        return grupo;
    }
}
