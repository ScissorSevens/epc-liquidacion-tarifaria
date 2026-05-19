using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.Aplicacion.Medidores;

/// <summary>
/// Servicio de aplicación para la gestión de Medidores.
/// Orquesta las operaciones de negocio usando el puerto de repositorio.
/// </summary>
public class ServicioMedidores : IServicioMedidores
{
    private readonly IRepositorioMedidor _repositorio;

    public ServicioMedidores(IRepositorioMedidor repositorio)
    {
        _repositorio = repositorio;
    }

    /// <summary>Retorna todos los medidores.</summary>
    public async Task<IReadOnlyList<Medidor>> ListarAsync(CancellationToken ct = default)
        => await _repositorio.ListarAsync(ct);

    /// <summary>Retorna un medidor por Id, o null si no existe.</summary>
    public async Task<Medidor?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _repositorio.ObtenerPorIdAsync(id, ct);

    /// <summary>Verifica que el suscriptor referenciado exista antes de agregar el medidor.</summary>
    public async Task<bool> ExisteSuscriptorAsync(int idSuscriptor, CancellationToken ct = default)
        => await _repositorio.ExisteSuscriptorAsync(idSuscriptor, ct);

    /// <summary>Persiste un nuevo medidor y guarda los cambios.</summary>
    public async Task AgregarAsync(Medidor entidad, CancellationToken ct = default)
    {
        await _repositorio.AgregarAsync(entidad, ct);
        await _repositorio.GuardarCambiosAsync(ct);
    }
}
