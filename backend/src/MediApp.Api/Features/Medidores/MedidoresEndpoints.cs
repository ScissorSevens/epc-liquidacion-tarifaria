using FluentValidation;
using MediApp.Api.Common;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Features.Medidores;

public static class MedidoresEndpoints
{
    public static RouteGroupBuilder MapMedidoresEndpoints(this RouteGroupBuilder grupo)
    {
        grupo.MapPost("/", async (
            SyncRequest<MedidorPayload> req,
            IValidator<MedidorPayload> validator,
            MediAppDbContext db,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("MedidoresEndpoints");

            // El FK al Suscriptor se resuelve mirando sync_registros: el mobile sólo conoce el
            // idCliente del Suscriptor, no su Id server. Cacheamos el id resuelto en una closure
            // capturada por mapToEntity/applyToEntity.
            int idSuscriptorResuelto = 0;

            return await SyncHandler.Handle<MedidorPayload, Medidor>(
                req,
                validator,
                p => MedidorMapper.PayloadAEntidad(p, idSuscriptorResuelto),
                (p, e) => MedidorMapper.AplicarPayload(p, e, idSuscriptorResuelto),
                e => e.Id,
                fkExistsCheck: async p =>
                {
                    var sync = await db.SyncRegistros
                        .FirstOrDefaultAsync(sr => sr.Tipo == "suscriptor"
                            && sr.IdCliente == p.IdSuscriptorCliente, ct);
                    if (sync is null)
                    {
                        return (false, $"FK orphan: suscriptor '{p.IdSuscriptorCliente}' no encontrado en server.");
                    }
                    idSuscriptorResuelto = sync.IdEntidad;
                    return (true, string.Empty);
                },
                tipo: "medidor",
                db,
                logger,
                ct);
        });

        return grupo;
    }
}
