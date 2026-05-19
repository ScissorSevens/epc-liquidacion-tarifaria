using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementación EF Core del repositorio de Operarios.
/// Incluye queries directas a BD para verificación de unicidad.
/// </summary>
public class RepositorioOperarioEF : IRepositorioOperario
{
    private readonly MediAppDbContext _db;

    public RepositorioOperarioEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Operario>> ListarAsync(CancellationToken ct = default)
        => await _db.Operarios
            .OrderBy(o => o.Nombre)
            .ToListAsync(ct);

    public async Task<Operario?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _db.Operarios.FindAsync(new object[] { id }, ct);

    public async Task AgregarAsync(Operario entidad, CancellationToken ct = default)
        => await _db.Operarios.AddAsync(entidad, ct);

    public async Task GuardarCambiosAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);

    /// <summary>Busca un operario por su número de cédula, o null si no existe.</summary>
    public async Task<Operario?> ObtenerPorCedulaAsync(string numeroCedula, CancellationToken ct = default)
        => await _db.Operarios.FirstOrDefaultAsync(o => o.NumeroCedula == numeroCedula, ct);

    /// <summary>Verifica si ya existe un operario con la cédula dada.</summary>
    public async Task<bool> ExisteCedulaAsync(string numeroCedula, CancellationToken ct = default)
        => await _db.Operarios.AnyAsync(o => o.NumeroCedula == numeroCedula, ct);

    /// <summary>Verifica si ya existe un operario con el email dado, excluyendo el id indicado.</summary>
    public async Task<bool> ExisteEmailAsync(string email, int? excluirId = null, CancellationToken ct = default)
        => await _db.Operarios.AnyAsync(
            o => o.Email == email && (excluirId == null || o.Id != excluirId), ct);

    /// <summary>Verifica si ya existe otro operario con el dispositivoId dado.</summary>
    public async Task<bool> ExisteDispositivoAsync(string dispositivoId, int excluirId, CancellationToken ct = default)
        => await _db.Operarios.AnyAsync(
            o => o.DispositivoId == dispositivoId && o.Id != excluirId, ct);
}
