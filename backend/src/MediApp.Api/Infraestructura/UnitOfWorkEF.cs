using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore.Storage;

namespace MediApp.Api.Infraestructura;

/// <summary>
/// Implementación EF Core de IUnitOfWork.
/// Delega transacciones a MediAppDbContext.Database y SaveChanges al contexto.
/// </summary>
public class UnitOfWorkEF : IUnitOfWork
{
    private readonly MediAppDbContext _db;

    public UnitOfWorkEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<ITransaccion> BeginTransactionAsync(CancellationToken ct = default)
    {
        var tx = await _db.Database.BeginTransactionAsync(ct);
        return new TransaccionEF(tx);
    }

    public async Task GuardarCambiosAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);
}

/// <summary>Adaptador que envuelve IDbContextTransaction en ITransaccion del dominio.</summary>
internal sealed class TransaccionEF : ITransaccion
{
    private readonly IDbContextTransaction _tx;

    public TransaccionEF(IDbContextTransaction tx)
    {
        _tx = tx;
    }

    public async Task CommitAsync(CancellationToken ct = default)
        => await _tx.CommitAsync(ct);

    public async Task RollbackAsync(CancellationToken ct = default)
        => await _tx.RollbackAsync(ct);

    public async ValueTask DisposeAsync()
        => await _tx.DisposeAsync();
}
