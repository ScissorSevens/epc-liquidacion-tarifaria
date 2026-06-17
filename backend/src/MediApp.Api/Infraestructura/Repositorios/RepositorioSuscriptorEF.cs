using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementación EF Core del repositorio de Suscriptores.
/// </summary>
public class RepositorioSuscriptorEF : IRepositorioSuscriptor
{
    private readonly MediAppDbContext _db;

    public RepositorioSuscriptorEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Suscriptor>> ListarAsync(CancellationToken ct = default)
        => await _db.Suscriptores
            .AsNoTracking()
            .OrderBy(s => s.Codigo)
            .ToListAsync(ct);

    public async Task<Suscriptor?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _db.Suscriptores.FindAsync(new object[] { id }, ct);

    public async Task AgregarAsync(Suscriptor entidad, CancellationToken ct = default)
        => await _db.Suscriptores.AddAsync(entidad, ct);

    public async Task GuardarCambiosAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);
}
