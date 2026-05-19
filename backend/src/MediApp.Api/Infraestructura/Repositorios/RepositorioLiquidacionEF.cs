using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementación EF Core del repositorio de Liquidaciones.
/// </summary>
public class RepositorioLiquidacionEF : IRepositorioLiquidacion
{
    private readonly MediAppDbContext _db;

    public RepositorioLiquidacionEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Liquidacion>> ListarAsync(CancellationToken ct = default)
        => await _db.Liquidaciones
            .Include(liq => liq.Lectura)
                .ThenInclude(l => l!.Medidor)
                    .ThenInclude(m => m!.Suscriptor)
            .OrderByDescending(liq => liq.Id)
            .ToListAsync(ct);

    public async Task<Liquidacion?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _db.Liquidaciones.FindAsync(new object[] { id }, ct);

    public async Task AgregarAsync(Liquidacion entidad, CancellationToken ct = default)
        => await _db.Liquidaciones.AddAsync(entidad, ct);

    public async Task GuardarCambiosAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);

    public async Task<bool> ExisteLecturaAsync(int idLectura, CancellationToken ct = default)
        => await _db.Lecturas.AnyAsync(l => l.Id == idLectura, ct);
}
