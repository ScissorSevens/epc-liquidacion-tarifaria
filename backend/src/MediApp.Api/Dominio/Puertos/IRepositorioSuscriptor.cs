using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio para la entidad Suscriptor.
/// La capa de Infraestructura provee la implementación concreta.
/// </summary>
public interface IRepositorioSuscriptor
{
    Task<IReadOnlyList<Suscriptor>> ListarAsync(CancellationToken ct = default);
    Task<Suscriptor?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task AgregarAsync(Suscriptor entidad, CancellationToken ct = default);
    Task GuardarCambiosAsync(CancellationToken ct = default);
}
