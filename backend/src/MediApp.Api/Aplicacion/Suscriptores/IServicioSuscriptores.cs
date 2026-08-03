using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Aplicacion.Suscriptores;

/// <summary>Contrato del servicio de aplicación para la gestión de Suscriptores.</summary>
public interface IServicioSuscriptores
{
    Task<IReadOnlyList<Suscriptor>> ListarAsync(CancellationToken ct = default);
    Task<Suscriptor?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task AgregarAsync(Suscriptor entidad, CancellationToken ct = default);
}
