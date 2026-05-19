using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.Aplicacion.Suscriptores;

/// <summary>
/// Servicio de aplicación para la gestión de Suscriptores.
/// Orquesta las operaciones de negocio usando el puerto de repositorio.
/// </summary>
public class ServicioSuscriptores : IServicioSuscriptores
{
    private readonly IRepositorioSuscriptor _repositorio;

    public ServicioSuscriptores(IRepositorioSuscriptor repositorio)
    {
        _repositorio = repositorio;
    }

    /// <summary>Retorna todos los suscriptores ordenados por código.</summary>
    public async Task<IReadOnlyList<Suscriptor>> ListarAsync(CancellationToken ct = default)
        => await _repositorio.ListarAsync(ct);

    /// <summary>Retorna un suscriptor por Id, o null si no existe.</summary>
    public async Task<Suscriptor?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _repositorio.ObtenerPorIdAsync(id, ct);

    /// <summary>Persiste un nuevo suscriptor y guarda los cambios.</summary>
    public async Task AgregarAsync(Suscriptor entidad, CancellationToken ct = default)
    {
        await _repositorio.AgregarAsync(entidad, ct);
        await _repositorio.GuardarCambiosAsync(ct);
    }
}
