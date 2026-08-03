using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Aplicacion.Operarios;

/// <summary>Contrato del servicio de aplicación para la gestión de Operarios.</summary>
public interface IServicioOperarios
{
    Task<IReadOnlyList<Operario>> ListarAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Operario>> ListarActivosAsync(CancellationToken ct = default);
    Task<Operario?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<Operario?> ObtenerPorCedulaAsync(string numeroCedula, CancellationToken ct = default);
    Task<bool> ExisteCedulaAsync(string numeroCedula, CancellationToken ct = default);
    Task<bool> ExisteEmailAsync(string email, int? excluirId = null, CancellationToken ct = default);
    Task<bool> ExisteDispositivoAsync(string dispositivoId, int excluirId, CancellationToken ct = default);
    Task AgregarAsync(Operario entidad, CancellationToken ct = default);
    Task ActualizarAsync(Operario entidad, CancellationToken ct = default);
}
