using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementacion EF Core del repositorio de Prestadores (multi-tenant).
/// Multi-tenant: tabla `prestadores`. Soporta soft-delete via campo `estado`.
/// </summary>
public class RepositorioPrestadorEF : IRepositorioPrestador
{
    private readonly MediAppDbContext _db;

    public RepositorioPrestadorEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Prestador>> ListarAsync(
        string? estado,
        short? segmento,
        string? search,
        int page,
        int limit,
        CancellationToken ct = default)
    {
        IQueryable<Prestador> q = _db.Prestadores.AsNoTracking();

        if (!string.IsNullOrEmpty(estado))
        {
            q = q.Where(p => p.Estado == estado);
        }
        if (segmento.HasValue)
        {
            q = q.Where(p => p.Segmento == segmento.Value);
        }
        if (!string.IsNullOrEmpty(search))
        {
            var s = $"%{search}%";
            q = q.Where(p =>
                EF.Functions.Like(p.Codigo, s) ||
                EF.Functions.Like(p.Nombre, s) ||
                EF.Functions.Like(p.Municipio, s) ||
                EF.Functions.Like(p.Nit, s));
        }

        return await q
            .OrderBy(p => p.Codigo)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);
    }

    public async Task<int> ContarAsync(
        string? estado,
        short? segmento,
        string? search,
        CancellationToken ct = default)
    {
        IQueryable<Prestador> q = _db.Prestadores.AsNoTracking();

        if (!string.IsNullOrEmpty(estado))
        {
            q = q.Where(p => p.Estado == estado);
        }
        if (segmento.HasValue)
        {
            q = q.Where(p => p.Segmento == segmento.Value);
        }
        if (!string.IsNullOrEmpty(search))
        {
            var s = $"%{search}%";
            q = q.Where(p =>
                EF.Functions.Like(p.Codigo, s) ||
                EF.Functions.Like(p.Nombre, s) ||
                EF.Functions.Like(p.Municipio, s) ||
                EF.Functions.Like(p.Nit, s));
        }

        return await q.CountAsync(ct);
    }

    public async Task<Prestador?> BuscarPorIdAsync(int idPrestador, CancellationToken ct = default)
        => await _db.Prestadores.FindAsync(new object[] { idPrestador }, ct);

    public async Task<bool> ExistePorCodigoAsync(string codigo, CancellationToken ct = default)
        => await _db.Prestadores.AnyAsync(p => p.Codigo == codigo, ct);

    public async Task<Prestador> CrearAsync(Prestador prestador, CancellationToken ct = default)
    {
        prestador.CreatedAt = DateTime.UtcNow;
        prestador.UpdatedAt = DateTime.UtcNow;
        _db.Prestadores.Add(prestador);
        await _db.SaveChangesAsync(ct);
        return prestador;
    }

    public async Task<Prestador> ActualizarAsync(int idPrestador, Prestador cambios, CancellationToken ct = default)
    {
        var actual = await _db.Prestadores.FindAsync(new object[] { idPrestador }, ct)
            ?? throw new InvalidOperationException($"Prestador {idPrestador} no encontrado");

        actual.Nombre = cambios.Nombre;
        actual.Nit = cambios.Nit;
        actual.Municipio = cambios.Municipio;
        actual.Departamento = cambios.Departamento;
        actual.Segmento = cambios.Segmento;
        actual.NumSuscriptoresUrbanos = cambios.NumSuscriptoresUrbanos;
        actual.NumSuscriptoresRurales = cambios.NumSuscriptoresRurales;
        actual.Contacto = cambios.Contacto;
        actual.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return actual;
    }

    public async Task<Prestador> SuspenderAsync(int idPrestador, CancellationToken ct = default)
    {
        var p = await _db.Prestadores.FindAsync(new object[] { idPrestador }, ct)
            ?? throw new InvalidOperationException($"Prestador {idPrestador} no encontrado");
        p.Estado = "suspendido";
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return p;
    }

    public async Task<Prestador> ReactivarAsync(int idPrestador, CancellationToken ct = default)
    {
        var p = await _db.Prestadores.FindAsync(new object[] { idPrestador }, ct)
            ?? throw new InvalidOperationException($"Prestador {idPrestador} no encontrado");
        p.Estado = "activo";
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return p;
    }
}
