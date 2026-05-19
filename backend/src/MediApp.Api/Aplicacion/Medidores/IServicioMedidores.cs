using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Aplicacion.Medidores;

/// <summary>Contrato del servicio de aplicación para la gestión de Medidores.</summary>
public interface IServicioMedidores
{
    Task<IReadOnlyList<Medidor>> ListarAsync(CancellationToken ct = default);
    Task<Medidor?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<bool> ExisteSuscriptorAsync(int idSuscriptor, CancellationToken ct = default);
    Task AgregarAsync(Medidor entidad, CancellationToken ct = default);
}
