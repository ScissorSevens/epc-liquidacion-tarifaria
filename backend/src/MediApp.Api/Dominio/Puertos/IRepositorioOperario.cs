using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio para la entidad Operario.
/// La capa de Infraestructura provee la implementación concreta.
/// </summary>
public interface IRepositorioOperario
{
    Task<IReadOnlyList<Operario>> ListarAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Operario>> ListarActivosAsync(CancellationToken ct = default);
    Task<Operario?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task AgregarAsync(Operario entidad, CancellationToken ct = default);
    Task GuardarCambiosAsync(CancellationToken ct = default);
    Task<Operario?> ObtenerPorCedulaAsync(string numeroCedula, CancellationToken ct = default);
    Task<bool> ExisteCedulaAsync(string numeroCedula, CancellationToken ct = default);
    Task<bool> ExisteEmailAsync(string email, int? excluirId = null, CancellationToken ct = default);
    Task<bool> ExisteDispositivoAsync(string dispositivoId, int excluirId, CancellationToken ct = default);
}
