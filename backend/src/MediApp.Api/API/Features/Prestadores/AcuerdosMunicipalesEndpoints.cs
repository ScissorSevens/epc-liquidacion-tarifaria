using FluentValidation;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Features.AcuerdosMunicipales;

namespace MediApp.Api.API.Features.Prestadores;

public static class AcuerdosMunicipalesEndpoints
{
    public static RouteGroupBuilder MapAcuerdosMunicipalesEndpoints(this RouteGroupBuilder grupo)
    {
        // GET /api/v1/prestadores/{id}/acuerdos — lista de acuerdos del prestador
        grupo.MapGet("/{idPrestador:int}/acuerdos", async (
            int idPrestador,
            IRepositorioAcuerdoMunicipal repo,
            CancellationToken ct) =>
        {
            var lista = await repo.ListarPorPrestadorAsync(idPrestador, ct);
            return Results.Ok(lista.Select(ToDto));
        });

        // GET /api/v1/prestadores/{id}/acuerdos/vigente — acuerdo vigente en la fecha actual
        grupo.MapGet("/{idPrestador:int}/acuerdos/vigente", async (
            int idPrestador,
            IRepositorioAcuerdoMunicipal repo,
            CancellationToken ct) =>
        {
            var fecha = ct == default ? DateTime.UtcNow.Date : DateTime.UtcNow.Date;
            var acuerdo = await repo.BuscarVigenteAsync(idPrestador, fecha, ct);
            return acuerdo is null
                ? Results.Ok(new { vigente = false, acuerdo = (object?)null })
                : Results.Ok(new { vigente = true, acuerdo = ToDto(acuerdo) });
        });

        // POST /api/v1/prestadores/{id}/acuerdos — crear
        grupo.MapPost("/{idPrestador:int}/acuerdos", async (
            int idPrestador,
            AcuerdoMunicipalPayload payload,
            IValidator<AcuerdoMunicipalPayload> validator,
            IRepositorioAcuerdoMunicipal repo,
            CancellationToken ct) =>
        {
            // Forzar que el path idPrestador coincida con el payload
            payload.IdPrestador = idPrestador;
            var result = await validator.ValidateAsync(payload, ct);
            if (!result.IsValid)
            {
                return Results.ValidationProblem(result.ToDictionary());
            }
            try
            {
                var acuerdo = AcuerdoMunicipalMapper.PayloadAEntidad(payload);
                var creado = await repo.CrearAsync(acuerdo, ct);
                return Results.Created(
                    $"/api/v1/prestadores/{idPrestador}/acuerdos/{creado.IdAcuerdo}",
                    ToDto(creado));
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("solapamiento") || ex.Message.Contains("ya existe"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        // PUT /api/v1/prestadores/{id}/acuerdos/{idAcuerdo} — actualizar
        grupo.MapPut("/{idPrestador:int}/acuerdos/{idAcuerdo:int}", async (
            int idPrestador,
            int idAcuerdo,
            AcuerdoMunicipalPayload payload,
            IValidator<AcuerdoMunicipalPayload> validator,
            IRepositorioAcuerdoMunicipal repo,
            CancellationToken ct) =>
        {
            payload.IdPrestador = idPrestador;
            var result = await validator.ValidateAsync(payload, ct);
            if (!result.IsValid)
            {
                return Results.ValidationProblem(result.ToDictionary());
            }
            try
            {
                var cambios = AcuerdoMunicipalMapper.PayloadAEntidad(payload);
                var actualizado = await repo.ActualizarAsync(idAcuerdo, cambios, ct);
                return Results.Ok(ToDto(actualizado));
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        return grupo;
    }

    private static object ToDto(Dominio.Entidades.AcuerdoMunicipal a) => new
    {
        a.IdAcuerdo,
        a.IdPrestador,
        a.FactorSubsidioE1,
        a.FactorSubsidioE2,
        a.FactorSubsidioE3,
        a.FactorContribucionE5,
        a.FactorContribucionE6,
        a.FactorContribucionComercial,
        a.FactorContribucionIndustrial,
        a.FechaVigenciaDesde,
        a.FechaVigenciaHasta,
        a.ActoAdministrativoUrl,
        a.Observaciones,
        a.CreatedAt,
    };
}
