using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementación EF Core de IRepositorioEntidad&lt;TEntity&gt;.
/// Permite a SyncHandler operar sobre cualquier entidad de dominio de forma genérica
/// sin depender de MediAppDbContext directamente.
/// </summary>
public class RepositorioEntidadEF<TEntity> : IRepositorioEntidad<TEntity> where TEntity : class
{
    private readonly MediAppDbContext _db;

    public RepositorioEntidadEF(MediAppDbContext db)
    {
        _db = db;
    }

    public void Agregar(TEntity entidad)
        => _db.Set<TEntity>().Add(entidad);

    public async Task<TEntity?> BuscarPorIdAsync(int id, CancellationToken ct = default)
        => await _db.Set<TEntity>().FindAsync(new object[] { id }, ct);
}
