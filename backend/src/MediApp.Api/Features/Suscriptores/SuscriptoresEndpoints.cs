using FluentValidation;
using MediApp.Api.Common;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Features.Suscriptores;

public static class SuscriptoresEndpoints
{
    public static RouteGroupBuilder MapSuscriptoresEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/suscriptores — sync desde mobile
        grupo.MapPost("/", async (
            SyncRequest<SuscriptorPayload> req,
            IValidator<SuscriptorPayload> validator,
            MediAppDbContext db,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("SuscriptoresEndpoints");
            return await SyncHandler.Handle<SuscriptorPayload, Suscriptor>(
                req,
                validator,
                SuscriptorMapper.PayloadAEntidad,
                SuscriptorMapper.AplicarPayload,
                e => e.Id,
                fkExistsCheck: null,
                tipo: "suscriptor",
                db,
                logger,
                ct);
        });

        // GET /api/v1/suscriptores — listado para el dashboard
        grupo.MapGet("/", async (MediAppDbContext db, CancellationToken ct) =>
        {
            var lista = await db.Suscriptores
                .OrderBy(s => s.Codigo)
                .Select(s => new
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
                })
                .ToListAsync(ct);
            return Results.Ok(lista);
        });

        return grupo;
    }
}
