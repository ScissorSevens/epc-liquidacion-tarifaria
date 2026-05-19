using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.Aplicacion.Liquidaciones;

/// <summary>
/// Servicio de aplicación para la gestión de Liquidaciones.
/// Orquesta las operaciones de negocio usando el puerto de repositorio.
/// </summary>
public class ServicioLiquidaciones : IServicioLiquidaciones
{
    private readonly IRepositorioLiquidacion _repositorio;

    public ServicioLiquidaciones(IRepositorioLiquidacion repositorio)
    {
        _repositorio = repositorio;
    }

    /// <summary>Retorna todas las liquidaciones.</summary>
    public async Task<IReadOnlyList<Liquidacion>> ListarAsync(CancellationToken ct = default)
        => await _repositorio.ListarAsync(ct);

    /// <summary>Retorna una liquidación por Id, o null si no existe.</summary>
    public async Task<Liquidacion?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _repositorio.ObtenerPorIdAsync(id, ct);

    /// <summary>Verifica que la lectura referenciada exista antes de agregar la liquidación.</summary>
    public async Task<bool> ExisteLecturaAsync(int idLectura, CancellationToken ct = default)
        => await _repositorio.ExisteLecturaAsync(idLectura, ct);

    /// <summary>Persiste una nueva liquidación y guarda los cambios.</summary>
    public async Task AgregarAsync(Liquidacion entidad, CancellationToken ct = default)
    {
        await _repositorio.AgregarAsync(entidad, ct);
        await _repositorio.GuardarCambiosAsync(ct);
    }
}
