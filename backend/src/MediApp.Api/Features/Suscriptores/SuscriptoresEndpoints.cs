using FluentValidation;
using MediApp.Api.Common;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;

namespace MediApp.Api.Features.Suscriptores;

public static class SuscriptoresEndpoints
{
    public static RouteGroupBuilder MapSuscriptoresEndpoints(this RouteGroupBuilder grupo)
    {
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

        return grupo;
    }
}
