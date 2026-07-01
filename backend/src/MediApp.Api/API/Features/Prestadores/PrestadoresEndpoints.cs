using FluentValidation;
using MediApp.Api.Aplicacion.Prestadores;
using MediApp.Api.Common;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Features.Prestadores;

namespace MediApp.Api.API.Features.Prestadores;

public static class PrestadoresEndpoints
{
    public static RouteGroupBuilder MapPrestadoresEndpoints(this RouteGroupBuilder grupo)
    {
        // GET /api/v1/prestadores?estado=&segmento=&search=&page=&limit=
        grupo.MapGet("/", async (
            IServicioPrestadores servicio,
            string? estado,
            short? segmento,
            string? search,
            int? page,
            int? limit,
            CancellationToken ct) =>
        {
            var p = page ?? 1;
            var l = limit ?? 50;
            var (items, total) = await servicio.ListarAsync(estado, segmento, search, p, l, ct);
            return Results.Ok(new
            {
                items = items.Select(ToDto),
                total,
                page = p,
                limit = l,
            });
        });

        // GET /api/v1/prestadores/{id} — detalle con acuerdos + parametros vigentes
        grupo.MapGet("/{id:int}", async (
            int id,
            IServicioPrestadores servicio,
            IRepositorioAcuerdoMunicipal repoAcuerdos,
            IRepositorioParametrosTarifa repoParametros,
            CancellationToken ct) =>
        {
            var prestador = await servicio.ObtenerPorIdAsync(id, ct);
            if (prestador is null)
            {
                return Results.NotFound(new { error = $"Prestador {id} no encontrado" });
            }
            var hoy = DateTime.UtcNow.Date;
            var acuerdo = await repoAcuerdos.BuscarVigenteAsync(id, hoy, ct);
            var parametros = await repoParametros.BuscarVigenteAsync(id, hoy, ct);
            return Results.Ok(new
            {
                prestador = ToDto(prestador),
                acuerdo_vigente = acuerdo is null ? null : new
                {
                    acuerdo.IdAcuerdo,
                    acuerdo.FactorSubsidioE1,
                    acuerdo.FactorSubsidioE2,
                    acuerdo.FactorSubsidioE3,
                    acuerdo.FactorContribucionE5,
                    acuerdo.FactorContribucionE6,
                    acuerdo.FactorContribucionComercial,
                    acuerdo.FactorContribucionIndustrial,
                    acuerdo.FechaVigenciaDesde,
                    acuerdo.FechaVigenciaHasta,
                },
                parametros_vigentes = parametros is null ? null : new
                {
                    parametros.IdParametros,
                    parametros.IdAcuerdo,
                    parametros.Periodo,
                    parametros.Cma,
                    parametros.Cmo,
                    parametros.Cmi,
                    parametros.Cmt,
                    parametros.Cmviaa,
                    parametros.AplicaCmviaa,
                    parametros.AguaSuministradaM3Anio,
                    parametros.IpufM3SuscriptorMes,
                    parametros.SuscriptoresPromedio,
                    parametros.AplicaMinimoVital,
                    parametros.M3GratisMinimoVital,
                    parametros.VigenteDesde,
                    parametros.VigenteHasta,
                },
            });
        });

        // POST /api/v1/prestadores — crear
        grupo.MapPost("/", async (
            PrestadorPayload payload,
            IValidator<PrestadorPayload> validator,
            IServicioPrestadores servicio,
            CancellationToken ct) =>
        {
            var result = await validator.ValidateAsync(payload, ct);
            if (!result.IsValid)
            {
                return Results.ValidationProblem(result.ToDictionary());
            }
            try
            {
                var prestador = PrestadorMapper.PayloadAEntidad(payload);
                var creado = await servicio.CrearAsync(prestador, ct);
                return Results.Created($"/api/v1/prestadores/{creado.IdPrestador}", ToDto(creado));
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("ya existe"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        // PUT /api/v1/prestadores/{id} — actualizar
        grupo.MapPut("/{id:int}", async (
            int id,
            PrestadorPayload payload,
            IValidator<PrestadorPayload> validator,
            IServicioPrestadores servicio,
            CancellationToken ct) =>
        {
            var result = await validator.ValidateAsync(payload, ct);
            if (!result.IsValid)
            {
                return Results.ValidationProblem(result.ToDictionary());
            }
            try
            {
                var cambios = PrestadorMapper.PayloadAEntidad(payload);
                var actualizado = await servicio.ActualizarAsync(id, cambios, ct);
                return Results.Ok(ToDto(actualizado));
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        // POST /api/v1/prestadores/{id}/suspender — soft-delete
        grupo.MapPost("/{id:int}/suspender", async (
            int id,
            IServicioPrestadores servicio,
            CancellationToken ct) =>
        {
            try
            {
                var p = await servicio.SuspenderAsync(id, ct);
                return Results.Ok(ToDto(p));
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        // POST /api/v1/prestadores/{id}/reactivar
        grupo.MapPost("/{id:int}/reactivar", async (
            int id,
            IServicioPrestadores servicio,
            CancellationToken ct) =>
        {
            try
            {
                var p = await servicio.ReactivarAsync(id, ct);
                return Results.Ok(ToDto(p));
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        return grupo;
    }

    private static object ToDto(Prestador p) => new
    {
        p.IdPrestador,
        p.Codigo,
        p.Nombre,
        p.Nit,
        p.Municipio,
        p.Departamento,
        p.Segmento,
        p.NumSuscriptoresUrbanos,
        p.NumSuscriptoresRurales,
        p.Contacto,
        p.Estado,
        p.CreatedAt,
        p.UpdatedAt,
    };
}
