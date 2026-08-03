namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de unidad de trabajo. Permite delimitar transacciones atómicas
/// sin exponer detalles de EF Core a las capas superiores.
/// </summary>
public interface IUnitOfWork
{
    /// <summary>Inicia una transacción de base de datos. Retornar el scope que debe ser confirmado o revertido.</summary>
    Task<ITransaccion> BeginTransactionAsync(CancellationToken ct = default);

    /// <summary>Persiste todos los cambios pendientes en el contexto actual.</summary>
    Task GuardarCambiosAsync(CancellationToken ct = default);
}

/// <summary>
/// Scope de una transacción activa. Implementado sobre IDbContextTransaction de EF Core
/// en la capa de Infraestructura.
/// </summary>
public interface ITransaccion : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct = default);
}
