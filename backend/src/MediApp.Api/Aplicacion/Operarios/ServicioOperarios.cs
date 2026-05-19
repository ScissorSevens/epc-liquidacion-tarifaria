using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.Aplicacion.Operarios;

/// <summary>
/// Servicio de aplicación para la gestión de Operarios.
/// Orquesta las operaciones de negocio usando el puerto de repositorio.
/// </summary>
public class ServicioOperarios : IServicioOperarios
{
    private readonly IRepositorioOperario _repositorio;

    public ServicioOperarios(IRepositorioOperario repositorio)
    {
        _repositorio = repositorio;
    }

    /// <summary>Retorna todos los operarios.</summary>
    public async Task<IReadOnlyList<Operario>> ListarAsync(CancellationToken ct = default)
        => await _repositorio.ListarAsync(ct);

    /// <summary>Retorna todos los operarios activos.</summary>
    public async Task<IReadOnlyList<Operario>> ListarActivosAsync(CancellationToken ct = default)
    {
        var todos = await _repositorio.ListarAsync(ct);
        return todos.Where(o => o.Estado == "activo").ToList();
    }

    /// <summary>Retorna un operario por Id, o null si no existe.</summary>
    public async Task<Operario?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _repositorio.ObtenerPorIdAsync(id, ct);

    /// <summary>Busca un operario por su número de cédula, o null si no existe.</summary>
    public async Task<Operario?> ObtenerPorCedulaAsync(string numeroCedula, CancellationToken ct = default)
        => await _repositorio.ObtenerPorCedulaAsync(numeroCedula, ct);

    /// <summary>
    /// Verifica que no exista otro operario con la misma NumeroCedula.
    /// Retorna true si la cédula ya está en uso.
    /// </summary>
    public async Task<bool> ExisteCedulaAsync(string numeroCedula, CancellationToken ct = default)
        => await _repositorio.ExisteCedulaAsync(numeroCedula, ct);

    /// <summary>
    /// Verifica que no exista otro operario con el mismo Email.
    /// Retorna true si el email ya está en uso (excluyendo el id indicado si se pasa).
    /// </summary>
    public async Task<bool> ExisteEmailAsync(string email, int? excluirId = null, CancellationToken ct = default)
        => await _repositorio.ExisteEmailAsync(email, excluirId, ct);

    /// <summary>
    /// Verifica que no exista otro operario con el mismo DispositivoId.
    /// Retorna true si el dispositivo ya está vinculado a otro operario.
    /// </summary>
    public async Task<bool> ExisteDispositivoAsync(string dispositivoId, int excluirId, CancellationToken ct = default)
        => await _repositorio.ExisteDispositivoAsync(dispositivoId, excluirId, ct);

    /// <summary>Persiste un nuevo operario y guarda los cambios.</summary>
    public async Task AgregarAsync(Operario entidad, CancellationToken ct = default)
    {
        await _repositorio.AgregarAsync(entidad, ct);
        await _repositorio.GuardarCambiosAsync(ct);
    }

    /// <summary>Actualiza un operario existente y guarda los cambios.</summary>
    public async Task ActualizarAsync(Operario entidad, CancellationToken ct = default)
        => await _repositorio.GuardarCambiosAsync(ct);
}
