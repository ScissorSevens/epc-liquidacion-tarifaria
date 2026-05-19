using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio para la entidad Liquidacion.
/// La capa de Infraestructura provee la implementación concreta.
/// </summary>
public interface IRepositorioLiquidacion
{
    Task<IReadOnlyList<Liquidacion>> ListarAsync(CancellationToken ct = default);
    Task<Liquidacion?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task AgregarAsync(Liquidacion entidad, CancellationToken ct = default);
    Task GuardarCambiosAsync(CancellationToken ct = default);
    Task<bool> ExisteLecturaAsync(int idLectura, CancellationToken ct = default);
}
