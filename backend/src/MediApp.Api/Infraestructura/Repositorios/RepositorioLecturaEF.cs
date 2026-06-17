using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementación EF Core del repositorio de Lecturas.
/// </summary>
public class RepositorioLecturaEF : IRepositorioLectura
{
    private readonly MediAppDbContext _db;

    public RepositorioLecturaEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Lectura>> ListarAsync(CancellationToken ct = default)
        => await _db.Lecturas
            .AsNoTracking()
            .Include(l => l.Medidor)
                .ThenInclude(m => m!.Suscriptor)
            .OrderByDescending(l => l.Periodo)
            .ToListAsync(ct);

    public async Task<Lectura?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _db.Lecturas.FindAsync(new object[] { id }, ct);

    public async Task AgregarAsync(Lectura entidad, CancellationToken ct = default)
        => await _db.Lecturas.AddAsync(entidad, ct);

    public async Task GuardarCambiosAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);

    public async Task<bool> ExisteMedidorAsync(int idMedidor, CancellationToken ct = default)
        => await _db.Medidores.AnyAsync(m => m.Id == idMedidor, ct);
}
