namespace MediApp.Api.Dominio.Puertos;

using MediApp.Api.Dominio.Entidades;

/// <summary>
/// Puerto del repositorio de Prestadores (multi-tenant).
/// Implementacion EF: <c>Infraestructura.Repositorios.RepositorioPrestadorEF</c>.
/// </summary>
public interface IRepositorioPrestador
{
    /// <summary>Lista prestadores con filtros opcionales y paginacion.</summary>
    Task<IReadOnlyList<Prestador>> ListarAsync(
        string? estado,
        short? segmento,
        string? search,
        int page,
        int limit,
        CancellationToken ct = default);

    /// <summary>Cuenta total para headers de paginacion.</summary>
    Task<int> ContarAsync(
        string? estado,
        short? segmento,
        string? search,
        CancellationToken ct = default);

    /// <summary>Busca por PK. Null si no existe.</summary>
    Task<Prestador?> BuscarPorIdAsync(int idPrestador, CancellationToken ct = default);

    /// <summary>Verifica si ya existe un prestador con ese codigo (unicidad).</summary>
    Task<bool> ExistePorCodigoAsync(string codigo, CancellationToken ct = default);

    /// <summary>Persiste un nuevo prestador y guarda cambios.</summary>
    Task<Prestador> CrearAsync(Prestador prestador, CancellationToken ct = default);

    /// <summary>Aplica cambios parciales. FKs se mantienen.</summary>
    Task<Prestador> ActualizarAsync(int idPrestador, Prestador cambios, CancellationToken ct = default);

    /// <summary>Soft-delete via estado='suspendido'.</summary>
    Task<Prestador> SuspenderAsync(int idPrestador, CancellationToken ct = default);

    /// <summary>Reactivar un prestador suspendido (estado='activo').</summary>
    Task<Prestador> ReactivarAsync(int idPrestador, CancellationToken ct = default);
}
