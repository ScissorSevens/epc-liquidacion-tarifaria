using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio para la entidad Medidor.
/// La capa de Infraestructura provee la implementación concreta.
/// </summary>
public interface IRepositorioMedidor
{
    Task<IReadOnlyList<Medidor>> ListarAsync(CancellationToken ct = default);
    Task<Medidor?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task AgregarAsync(Medidor entidad, CancellationToken ct = default);
    Task GuardarCambiosAsync(CancellationToken ct = default);
    Task<bool> ExisteSuscriptorAsync(int idSuscriptor, CancellationToken ct = default);
}
