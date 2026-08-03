using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.Aplicacion.Lecturas;

/// <summary>
/// Servicio de aplicación para la gestión de Lecturas.
/// Orquesta las operaciones de negocio usando el puerto de repositorio.
/// </summary>
public class ServicioLecturas : IServicioLecturas
{
    private readonly IRepositorioLectura _repositorio;

    public ServicioLecturas(IRepositorioLectura repositorio)
    {
        _repositorio = repositorio;
    }

    /// <summary>Retorna todas las lecturas.</summary>
    public async Task<IReadOnlyList<Lectura>> ListarAsync(CancellationToken ct = default)
        => await _repositorio.ListarAsync(ct);

    /// <summary>Retorna una lectura por Id, o null si no existe.</summary>
    public async Task<Lectura?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _repositorio.ObtenerPorIdAsync(id, ct);

    /// <summary>Verifica que el medidor referenciado exista antes de agregar la lectura.</summary>
    public async Task<bool> ExisteMedidorAsync(int idMedidor, CancellationToken ct = default)
        => await _repositorio.ExisteMedidorAsync(idMedidor, ct);

    /// <summary>Persiste una nueva lectura y guarda los cambios.</summary>
    public async Task AgregarAsync(Lectura entidad, CancellationToken ct = default)
    {
        await _repositorio.AgregarAsync(entidad, ct);
        await _repositorio.GuardarCambiosAsync(ct);
    }
}
