using FluentValidation;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Features.Operarios;

public static class OperariosEndpoints
{
    public static RouteGroupBuilder MapOperariosEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/operarios — crear nuevo operario
        grupo.MapPost("/", async (
            OperarioPayload payload,
            IValidator<OperarioPayload> validator,
            MediAppDbContext db,
            CancellationToken ct) =>
        {
            // Validar payload
            var resultado = await validator.ValidateAsync(payload, ct);
            if (!resultado.IsValid)
                return Results.ValidationProblem(resultado.ToDictionary());

            // 409 si NumeroCedula ya existe
            var cedulaDuplicada = await db.Operarios
                .AnyAsync(o => o.NumeroCedula == payload.NumeroCedula, ct);
            if (cedulaDuplicada)
                return Results.Conflict(new { error = $"Ya existe un operario con NumeroCedula '{payload.NumeroCedula}'." });

            // 409 si Email ya existe
            var emailDuplicado = await db.Operarios
                .AnyAsync(o => o.Email == payload.Email, ct);
            if (emailDuplicado)
                return Results.Conflict(new { error = $"Ya existe un operario con Email '{payload.Email}'." });

            var entidad = OperarioMapper.PayloadAEntidad(payload);
            db.Operarios.Add(entidad);
            await db.SaveChangesAsync(ct);

            // Retornar 201 SIN PasswordHash
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
            MediAppDbContext db,
            bool soloActivos = false,
            CancellationToken ct = default) =>
        {
            var query = db.Operarios.AsQueryable();

            if (soloActivos)
                query = query.Where(o => o.Estado == "activo");

            var lista = await query
                .OrderBy(o => o.Nombre)
                .Select(o => new
                {
                    o.Id,
                    o.NumeroCedula,
                    o.Nombre,
                    o.Email,
                    o.Rol,
                    o.Estado,
                    o.DispositivoId,
                    o.CreatedAt,
                })
                .ToListAsync(ct);

            return Results.Ok(lista);
        });

        // PUT /api/v1/operarios/{id} — actualizar operario existente
        grupo.MapPut("/{id:int}", async (
            int id,
            OperarioUpdatePayload payload,
            MediAppDbContext db,
            CancellationToken ct) =>
        {
            var entidad = await db.Operarios.FindAsync(new object[] { id }, ct);
            if (entidad is null)
                return Results.NotFound(new { error = $"No existe un operario con Id {id}." });

            // 409 si el nuevo Email ya pertenece a OTRO operario
            if (payload.Email is not null)
            {
                var emailDuplicado = await db.Operarios
                    .AnyAsync(o => o.Email == payload.Email && o.Id != id, ct);
                if (emailDuplicado)
                    return Results.Conflict(new { error = $"Ya existe otro operario con Email '{payload.Email}'." });
            }

            OperarioMapper.AplicarPayload(payload, entidad);
            await db.SaveChangesAsync(ct);

            // Retornar 200 SIN PasswordHash
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
            MediAppDbContext db,
            CancellationToken ct) =>
        {
            // Buscar por NumeroCedula
            var entidad = await db.Operarios
                .FirstOrDefaultAsync(o => o.NumeroCedula == payload.Cedula, ct);
            if (entidad is null)
                return Results.NotFound(new { error = $"No existe un operario con cédula '{payload.Cedula}'." });

            // Verificar contraseña
            bool passwordValida = BCrypt.Net.BCrypt.Verify(payload.Password, entidad.PasswordHash);
            if (!passwordValida)
                return Results.Json(new { error = "Cédula o contraseña incorrectos." }, statusCode: 401);

            // Si el mismo operario ya tiene ese DispositivoId → idempotente, retornar 200
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

            // 409 si DispositivoId ya está en OTRO operario
            var dispositivoDuplicado = await db.Operarios
                .AnyAsync(o => o.DispositivoId == payload.DispositivoId && o.Id != entidad.Id, ct);
            if (dispositivoDuplicado)
                return Results.Conflict(new { error = $"El dispositivo '{payload.DispositivoId}' ya está vinculado a otro operario." });

            entidad.DispositivoId = payload.DispositivoId;
            await db.SaveChangesAsync(ct);

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
