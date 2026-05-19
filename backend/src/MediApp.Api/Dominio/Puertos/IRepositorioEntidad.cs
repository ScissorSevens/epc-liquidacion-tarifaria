namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio genérico para operaciones de escritura sobre cualquier entidad.
/// Usado exclusivamente por SyncHandler para INSERT y FindAsync sin acoplar el handler
/// a una entidad de dominio concreta.
/// </summary>
public interface IRepositorioEntidad<TEntity> where TEntity : class
{
    /// <summary>Agrega la entidad al contexto (pendiente de SaveChanges).</summary>
    void Agregar(TEntity entidad);

    /// <summary>Busca la entidad por clave primaria entera.</summary>
    Task<TEntity?> BuscarPorIdAsync(int id, CancellationToken ct = default);
}
