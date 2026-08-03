using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementación EF Core del repositorio de SyncRegistros.
/// </summary>
public class RepositorioSyncRegistroEF : IRepositorioSyncRegistro
{
    private readonly MediAppDbContext _db;

    public RepositorioSyncRegistroEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<SyncRegistro?> BuscarPorClienteYTipoAsync(string idCliente, string tipo, CancellationToken ct = default)
        => await _db.SyncRegistros
            .FirstOrDefaultAsync(sr => sr.IdCliente == idCliente && sr.Tipo == tipo, ct);

    public async Task AgregarAsync(SyncRegistro registro, CancellationToken ct = default)
        => await _db.SyncRegistros.AddAsync(registro, ct);

    public async Task GuardarCambiosAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);
}
