using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementación EF Core del repositorio de Medidores.
/// </summary>
public class RepositorioMedidorEF : IRepositorioMedidor
{
    private readonly MediAppDbContext _db;

    public RepositorioMedidorEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Medidor>> ListarAsync(CancellationToken ct = default)
        => await _db.Medidores
            .Include(m => m.Suscriptor)
            .OrderBy(m => m.NumeroMedidor)
            .ToListAsync(ct);

    public async Task<Medidor?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _db.Medidores.FindAsync(new object[] { id }, ct);

    public async Task AgregarAsync(Medidor entidad, CancellationToken ct = default)
        => await _db.Medidores.AddAsync(entidad, ct);

    public async Task GuardarCambiosAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);

    public async Task<bool> ExisteSuscriptorAsync(int idSuscriptor, CancellationToken ct = default)
        => await _db.Suscriptores.AnyAsync(s => s.Id == idSuscriptor, ct);
}
