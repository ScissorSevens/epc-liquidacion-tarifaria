using FluentValidation;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Features.ParametrosTarifa;

namespace MediApp.Api.API.Features.Prestadores;

public static class ParametrosTarifaEndpoints
{
    public static RouteGroupBuilder MapParametrosTarifaEndpoints(this RouteGroupBuilder grupo)
    {
        // GET /api/v1/prestadores/{id}/parametros — lista de parametros del prestador
        grupo.MapGet("/{idPrestador:int}/parametros", async (
            int idPrestador,
            IRepositorioParametrosTarifa repo,
            CancellationToken ct) =>
        {
            var lista = await repo.ListarPorPrestadorAsync(idPrestador, ct);
            return Results.Ok(lista.Select(ToDto));
        });

        // GET /api/v1/prestadores/{id}/parametros/vigentes — vigentes en la fecha actual
        grupo.MapGet("/{idPrestador:int}/parametros/vigentes", async (
            int idPrestador,
            IRepositorioParametrosTarifa repo,
            CancellationToken ct) =>
        {
            var fecha = DateTime.UtcNow.Date;
            var parametros = await repo.BuscarVigenteAsync(idPrestador, fecha, ct);
            return parametros is null
                ? Results.Ok(new { vigente = false, parametros = (object?)null })
                : Results.Ok(new { vigente = true, parametros = ToDto(parametros) });
        });

        // POST /api/v1/prestadores/{id}/parametros — crear
        grupo.MapPost("/{idPrestador:int}/parametros", async (
            int idPrestador,
            ParametrosTarifaPayload payload,
            IValidator<ParametrosTarifaPayload> validator,
            IRepositorioParametrosTarifa repo,
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
                var parametros = ParametrosTarifaMapper.PayloadAEntidad(payload);
                var creado = await repo.CrearAsync(parametros, ct);
                return Results.Created(
                    $"/api/v1/prestadores/{idPrestador}/parametros/{creado.IdParametros}",
                    ToDto(creado));
            }
            catch (InvalidOperationException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        // PUT /api/v1/prestadores/{id}/parametros/{idParametros} — actualizar
        grupo.MapPut("/{idPrestador:int}/parametros/{idParametros:int}", async (
            int idPrestador,
            int idParametros,
            ParametrosTarifaPayload payload,
            IValidator<ParametrosTarifaPayload> validator,
            IRepositorioParametrosTarifa repo,
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
                var cambios = ParametrosTarifaMapper.PayloadAEntidad(payload);
                var actualizado = await repo.ActualizarAsync(idParametros, cambios, ct);
                return Results.Ok(ToDto(actualizado));
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        return grupo;
    }

    private static object ToDto(MediApp.Api.Dominio.Entidades.ParametrosTarifa p) => new
    {
        p.IdParametros,
        p.IdPrestador,
        p.IdAcuerdo,
        p.Periodo,
        p.Cma,
        p.Cmo,
        p.Cmi,
        p.Cmt,
        p.Cmviaa,
        p.AplicaCmviaa,
        p.AguaSuministradaM3Anio,
        p.IpufM3SuscriptorMes,
        p.SuscriptoresPromedio,
        p.AplicaMinimoVital,
        p.M3GratisMinimoVital,
        // Res 825/2017 compliance.
        p.IpufIndice,
        p.CargoFijoResultante,
        p.CargoConsumoResultante,
        p.ComponentesAplicables,
        p.VigenteDesde,
        p.VigenteHasta,
        p.CreatedAt,
    };
}
