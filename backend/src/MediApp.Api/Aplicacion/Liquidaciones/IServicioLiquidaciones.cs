using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Aplicacion.Liquidaciones;

/// <summary>Contrato del servicio de aplicación para la gestión de Liquidaciones.</summary>
public interface IServicioLiquidaciones
{
    Task<IReadOnlyList<Liquidacion>> ListarAsync(CancellationToken ct = default);
    Task<Liquidacion?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<bool> ExisteLecturaAsync(int idLectura, CancellationToken ct = default);
    Task AgregarAsync(Liquidacion entidad, CancellationToken ct = default);
}
