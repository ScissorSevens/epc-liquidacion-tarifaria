using FluentValidation;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MediApp.Api.Common;

/// <summary>
/// Handler genérico de sync con detección 201/200/409/400/404 (protocolo #213).
/// Encapsula la lógica de idempotencia por (idCliente, tipo) + hash, transacción atómica
/// que toca entidad de negocio + sync_registros, y manejo de FK orphan.
/// </summary>
public static class SyncHandler
{
    /// <param name="req">Sobre completo del mobile.</param>
    /// <param name="validator">Validator de FluentValidation para el payload.</param>
    /// <param name="mapToEntity">Crea la entidad nueva a partir del payload (para INSERT).</param>
    /// <param name="applyToEntity">Aplica los cambios del payload a una entidad existente (para sobrescritura). Recibe la entidad cargada.</param>
    /// <param name="idGetter">Devuelve el Id server post-save.</param>
    /// <param name="fkExistsCheck">Si no es null, valida que las FKs existan; falso => 404.</param>
    /// <param name="tipo">Etiqueta corta para sync_registros (ej. "suscriptor").</param>
    /// <param name="preProcess">
    /// Hook opcional ejecutado DESPUÉS de validar/FK-check y ANTES de mapear a entidad. Sirve para
    /// efectos colaterales que requieran I/O (ej. Lectura: persistir foto en filesystem y mutar
    /// el payload para inyectar la ruta resuelta). Solo se llama cuando hay INSERT real (caso A)
    /// o UPDATE forzado (caso C). NO se llama en el caso 200 idempotente porque no hay cambio
    /// efectivo en DB y por lo tanto no debe haber side-effect (evita re-guardar foto idéntica).
    /// </param>
    public static async Task<IResult> Handle<TPayload, TEntity>(
        SyncRequest<TPayload> req,
        IValidator<TPayload> validator,
        Func<TPayload, TEntity> mapToEntity,
        Action<TPayload, TEntity> applyToEntity,
        Func<TEntity, int> idGetter,
        Func<TPayload, Task<(bool Ok, string Detail)>>? fkExistsCheck,
        string tipo,
        MediAppDbContext db,
        ILogger logger,
        CancellationToken ct,
        Func<TPayload, CancellationToken, Task>? preProcess = null)
        where TEntity : class
    {
        // 1. Validación de payload de negocio.
        var validationResult = await validator.ValidateAsync(req.Payload, ct);
        if (!validationResult.IsValid)
        {
            var errores = validationResult.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
            return ProblemDetailsExtensions.BadRequest400("El payload no pasó la validación.", errores);
        }

        // 2. idCliente con formato `dispositivo:id_local`.
        if (!HashUtil.EsIdClienteValido(req.IdCliente))
        {
            return ProblemDetailsExtensions.BadRequest400(
                $"idCliente '{req.IdCliente}' no respeta el formato `dispositivo:id_local`.");
        }

        // 3. hashLocal sha256 hex 64.
        if (!HashUtil.EsSha256HexValido(req.HashLocal))
        {
            return ProblemDetailsExtensions.BadRequest400(
                "hashLocal debe ser SHA-256 hex de 64 caracteres en minúsculas.");
        }

        // 4. FK existence check (lectura/liquidacion/medidor).
        if (fkExistsCheck is not null)
        {
            var (ok, detail) = await fkExistsCheck(req.Payload);
            if (!ok)
            {
                return ProblemDetailsExtensions.NotFound404(detail);
            }
        }

        // 5. Buscar SyncRegistro existente por (idCliente, tipo).
        var registro = await db.SyncRegistros
            .FirstOrDefaultAsync(sr => sr.IdCliente == req.IdCliente && sr.Tipo == tipo, ct);

        if (registro is null)
        {
            // Caso A: NUEVO. INSERT entidad + INSERT sync_registro en una transacción.
            // preProcess corre acá: hay cambio efectivo en DB, los side-effects son válidos.
            if (preProcess is not null)
            {
                await preProcess(req.Payload, ct);
            }

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            try
            {
                var entidad = mapToEntity(req.Payload);
                db.Set<TEntity>().Add(entidad);
                await db.SaveChangesAsync(ct);

                var idServer = idGetter(entidad);

                db.SyncRegistros.Add(new SyncRegistro
                {
                    IdCliente = req.IdCliente,
                    Tipo = tipo,
                    HashServer = req.HashLocal,
                    IdEntidad = idServer,
                    FechaSync = DateTimeOffset.UtcNow
                });
                await db.SaveChangesAsync(ct);

                await tx.CommitAsync(ct);
                return Results.Created($"/api/v1/{tipo}s/{idServer}", new SyncResponse(idServer, req.HashLocal));
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }

        // Caso B: ya hay registro previo.
        if (registro.HashServer == req.HashLocal)
        {
            // Idempotente: mismo cliente, mismo hash. Sin tocar DB.
            return Results.Ok(new SyncResponse(registro.IdEntidad, registro.HashServer));
        }

        // Hashes distintos.
        if (!req.ForzarSobrescribir)
        {
            return ProblemDetailsExtensions.Conflict409WithHash(
                registro.HashServer,
                $"El servidor ya tiene una versión distinta de '{tipo}' para idCliente '{req.IdCliente}'. " +
                "Reintentá con forzarSobrescribir=true para pisar la versión del server.");
        }

        // Sobrescritura forzada.
        // preProcess corre acá también: vamos a UPDATE real, side-effects válidos.
        if (preProcess is not null)
        {
            await preProcess(req.Payload, ct);
        }

        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            try
            {
                var entidad = await db.Set<TEntity>().FindAsync(new object?[] { registro.IdEntidad }, ct);
                if (entidad is null)
                {
                    logger.LogCritical(
                        "Estado inconsistente: sync_registro {IdSync} apunta a {Tipo} {IdEntidad} que no existe.",
                        registro.Id, tipo, registro.IdEntidad);
                    await tx.RollbackAsync(ct);
                    return Results.Problem(
                        title: "Estado inconsistente del servidor",
                        detail: "El registro de sync apunta a una entidad inexistente. Contactá al admin.",
                        statusCode: StatusCodes.Status500InternalServerError);
                }

                applyToEntity(req.Payload, entidad);
                await db.SaveChangesAsync(ct);

                registro.HashServer = req.HashLocal;
                registro.FechaSync = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);

                await tx.CommitAsync(ct);
                return Results.Ok(new SyncResponse(registro.IdEntidad, registro.HashServer));
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }
    }
}
