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

        return grupo;
    }
}
