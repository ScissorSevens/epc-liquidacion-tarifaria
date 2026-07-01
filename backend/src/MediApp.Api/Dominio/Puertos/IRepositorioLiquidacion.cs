using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio para la entidad Liquidacion.
/// La capa de Infraestructura provee la implementación concreta.
/// </summary>
public interface IRepositorioLiquidacion
{
    Task<IReadOnlyList<Liquidacion>> ListarAsync(CancellationToken ct = default);

    /// <summary>
    /// Lista las liquidaciones del prestador (multi-tenant). Usado por el
    /// endpoint GET /api/v1/liquidaciones?prestador_id=X.
    /// </summary>
    Task<IReadOnlyList<Liquidacion>> ListarPorPrestadorAsync(int idPrestador, CancellationToken ct = default);

    Task<Liquidacion?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task AgregarAsync(Liquidacion entidad, CancellationToken ct = default);
    Task GuardarCambiosAsync(CancellationToken ct = default);
    Task<bool> ExisteLecturaAsync(int idLectura, CancellationToken ct = default);
}
