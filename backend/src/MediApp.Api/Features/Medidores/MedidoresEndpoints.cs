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
        // POST /api/v1/medidores — sync desde mobile
        grupo.MapPost("/", async (
            SyncRequest<MedidorPayload> req,
            IValidator<MedidorPayload> validator,
            MediAppDbContext db,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("MedidoresEndpoints");

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

        // GET /api/v1/medidores — listado para el dashboard
        grupo.MapGet("/", async (MediAppDbContext db, CancellationToken ct) =>
        {
            var lista = await db.Medidores
                .Include(m => m.Suscriptor)
                .OrderBy(m => m.NumeroMedidor)
                .Select(m => new
                {
                    m.Id,
                    m.NumeroMedidor,
                    m.FechaInstalacion,
                    m.Estado,
                    m.Observaciones,
                    m.IdSuscriptor,
                    NombreSuscriptor = m.Suscriptor != null ? m.Suscriptor.NombreApellidos : null,
                    CodigoSuscriptor = m.Suscriptor != null ? m.Suscriptor.Codigo : null,
                })
                .ToListAsync(ct);
            return Results.Ok(lista);
        });

        return grupo;
    }
}
