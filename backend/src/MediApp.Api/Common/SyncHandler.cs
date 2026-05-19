using FluentValidation;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace MediApp.Api.Common;

/// <summary>
/// Handler genérico de sync con detección 201/200/409/400/404 (protocolo #213).
/// Encapsula la lógica de idempotencia por (idCliente, tipo) + hash, transacción atómica
/// que toca entidad de negocio + sync_registros, y manejo de FK orphan.
/// </summary>
public class SyncHandler
{
    private readonly IRepositorioSyncRegistro _syncRegistros;
    private readonly IUnitOfWork _uow;

    public SyncHandler(IRepositorioSyncRegistro syncRegistros, IUnitOfWork uow)
    {
        _syncRegistros = syncRegistros;
        _uow = uow;
    }

    /// <param name="req">Sobre completo del mobile.</param>
    /// <param name="validator">Validator de FluentValidation para el payload.</param>
    /// <param name="repositorio">Repositorio genérico de la entidad concreta (INSERT/FindAsync).</param>
    /// <param name="mapToEntity">Crea la entidad nueva a partir del payload (para INSERT).</param>
    /// <param name="applyToEntity">Aplica los cambios del payload a una entidad existente (para sobrescritura).</param>
    /// <param name="idGetter">Devuelve el Id server post-save.</param>
    /// <param name="fkExistsCheck">Si no es null, valida que las FKs existan; falso => 404.</param>
    /// <param name="tipo">Etiqueta corta para sync_registros (ej. "suscriptor").</param>
    /// <param name="preProcess">
    /// Hook opcional ejecutado DESPUÉS de validar/FK-check y ANTES de mapear a entidad. Sirve para
    /// efectos colaterales que requieran I/O (ej. Lectura: persistir foto en filesystem y mutar
    /// el payload para inyectar la ruta resuelta). Solo se llama cuando hay INSERT real (caso A)
    /// o UPDATE forzado (caso C). NO se llama en el caso 200 idempotente.
    /// </param>
    public async Task<IResult> HandleAsync<TPayload, TEntity>(
        SyncRequest<TPayload> req,
        IValidator<TPayload> validator,
        IRepositorioEntidad<TEntity> repositorio,
        Func<TPayload, TEntity> mapToEntity,
        Action<TPayload, TEntity> applyToEntity,
        Func<TEntity, int> idGetter,
        Func<TPayload, Task<(bool Ok, string Detail)>>? fkExistsCheck,
        string tipo,
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
                return ProblemDetailsExtensions.NotFound404(detail);
        }

        // 5. Buscar SyncRegistro existente por (idCliente, tipo).
        var registro = await _syncRegistros.BuscarPorClienteYTipoAsync(req.IdCliente, tipo, ct);

        if (registro is null)
        {
            // Caso A: NUEVO. INSERT entidad + INSERT sync_registro en una transacción.
            if (preProcess is not null)
                await preProcess(req.Payload, ct);

            await using var tx = await _uow.BeginTransactionAsync(ct);
            try
            {
                var entidad = mapToEntity(req.Payload);
                repositorio.Agregar(entidad);
                await _uow.GuardarCambiosAsync(ct);

                var idServer = idGetter(entidad);

                await _syncRegistros.AgregarAsync(new SyncRegistro
                {
                    IdCliente = req.IdCliente,
                    Tipo = tipo,
                    HashServer = req.HashLocal,
                    IdEntidad = idServer,
                    FechaSync = DateTimeOffset.UtcNow
                }, ct);
                await _uow.GuardarCambiosAsync(ct);

                await tx.CommitAsync(ct);
                return Results.Created($"/api/v1/{tipo}s/{idServer}", new SyncResponse(idServer, req.HashLocal));
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }

        // Caso B: ya hay registro previo — mismo hash → idempotente.
        if (registro.HashServer == req.HashLocal)
            return Results.Ok(new SyncResponse(registro.IdEntidad, registro.HashServer));

        // Hashes distintos.
        if (!req.ForzarSobrescribir)
        {
            return ProblemDetailsExtensions.Conflict409WithHash(
                registro.HashServer,
                $"El servidor ya tiene una versión distinta de '{tipo}' para idCliente '{req.IdCliente}'. " +
                "Reintentá con forzarSobrescribir=true para pisar la versión del server.");
        }

        // Caso C: sobrescritura forzada.
        if (preProcess is not null)
            await preProcess(req.Payload, ct);

        await using (var tx = await _uow.BeginTransactionAsync(ct))
        {
            try
            {
                var entidad = await repositorio.BuscarPorIdAsync(registro.IdEntidad, ct);
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
                await _uow.GuardarCambiosAsync(ct);

                registro.HashServer = req.HashLocal;
                registro.FechaSync = DateTimeOffset.UtcNow;
                await _uow.GuardarCambiosAsync(ct);

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
