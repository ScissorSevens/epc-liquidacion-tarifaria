using FluentValidation;
using MediApp.Api.Aplicacion.Operarios;
using MediApp.Api.Features.Operarios;

namespace MediApp.Api.API.Features.Operarios;

public static class OperariosEndpoints
{
    public static RouteGroupBuilder MapOperariosEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/operarios — crear nuevo operario
        grupo.MapPost("/", async (
            OperarioPayload payload,
            IValidator<OperarioPayload> validator,
            IServicioOperarios servicio,
            CancellationToken ct) =>
        {
            var resultado = await validator.ValidateAsync(payload, ct);
            if (!resultado.IsValid)
                return Results.ValidationProblem(resultado.ToDictionary());

            if (await servicio.ExisteCedulaAsync(payload.NumeroCedula, ct))
                return Results.Conflict(new { error = $"Ya existe un operario con NumeroCedula '{payload.NumeroCedula}'." });

            if (await servicio.ExisteEmailAsync(payload.Email, excluirId: null, ct))
                return Results.Conflict(new { error = $"Ya existe un operario con Email '{payload.Email}'." });

            var entidad = OperarioMapper.PayloadAEntidad(payload);
            await servicio.AgregarAsync(entidad, ct);

            return Results.Created($"/api/v1/operarios/{entidad.Id}", new
            {
                entidad.Id,
                entidad.NumeroCedula,
                entidad.Nombre,
                entidad.Email,
                entidad.Rol,
                entidad.Estado,
                entidad.DispositivoId,
                entidad.CreatedAt,
            });
        });

        // GET /api/v1/operarios — listar operarios
        grupo.MapGet("/", async (
            IServicioOperarios servicio,
            bool soloActivos = false,
            CancellationToken ct = default) =>
        {
            var lista = soloActivos
                ? await servicio.ListarActivosAsync(ct)
                : await servicio.ListarAsync(ct);

            return Results.Ok(lista.Select(o => new
            {
                o.Id,
                o.NumeroCedula,
                o.Nombre,
                o.Email,
                o.Rol,
                o.Estado,
                o.DispositivoId,
                o.CreatedAt,
            }));
        });

        // PUT /api/v1/operarios/{id} — actualizar operario existente
        grupo.MapPut("/{id:int}", async (
            int id,
            OperarioUpdatePayload payload,
            IServicioOperarios servicio,
            CancellationToken ct) =>
        {
            var entidad = await servicio.ObtenerPorIdAsync(id, ct);
            if (entidad is null)
                return Results.NotFound(new { error = $"No existe un operario con Id {id}." });

            if (payload.Email is not null)
            {
                if (await servicio.ExisteEmailAsync(payload.Email, excluirId: id, ct))
                    return Results.Conflict(new { error = $"Ya existe otro operario con Email '{payload.Email}'." });
            }

            OperarioMapper.AplicarPayload(payload, entidad);
            await servicio.ActualizarAsync(entidad, ct);

            return Results.Ok(new
            {
                entidad.Id,
                entidad.NumeroCedula,
                entidad.Nombre,
                entidad.Email,
                entidad.Rol,
                entidad.Estado,
                entidad.DispositivoId,
                entidad.CreatedAt,
            });
        });

        // PATCH /api/v1/operarios/vincular-dispositivo — vincular dispositivo móvil
        grupo.MapPatch("/vincular-dispositivo", async (
            VincularDispositivoPayload payload,
            IServicioOperarios servicio,
            CancellationToken ct) =>
        {
            var entidad = await servicio.ObtenerPorCedulaAsync(payload.Cedula, ct);
            if (entidad is null)
                return Results.NotFound(new { error = $"No existe un operario con cédula '{payload.Cedula}'." });

            bool passwordValida = BCrypt.Net.BCrypt.Verify(payload.Password, entidad.PasswordHash);
            if (!passwordValida)
                return Results.Json(new { error = "Cédula o contraseña incorrectos." }, statusCode: 401);

            // Idempotente: mismo dispositivo ya vinculado al mismo operario
            if (entidad.DispositivoId == payload.DispositivoId)
                return Results.Ok(new
                {
                    entidad.Id,
                    entidad.NumeroCedula,
                    entidad.Nombre,
                    entidad.Email,
                    entidad.Rol,
                    entidad.Estado,
                    entidad.DispositivoId,
                    entidad.CreatedAt,
                });

            if (await servicio.ExisteDispositivoAsync(payload.DispositivoId, entidad.Id, ct))
                return Results.Conflict(new { error = $"El dispositivo '{payload.DispositivoId}' ya está vinculado a otro operario." });

            entidad.DispositivoId = payload.DispositivoId;
            await servicio.ActualizarAsync(entidad, ct);

            return Results.Ok(new
            {
                entidad.Id,
                entidad.NumeroCedula,
                entidad.Nombre,
                entidad.Email,
                entidad.Rol,
                entidad.Estado,
                entidad.DispositivoId,
                entidad.CreatedAt,
            });
        });

        return grupo;
    }
}
