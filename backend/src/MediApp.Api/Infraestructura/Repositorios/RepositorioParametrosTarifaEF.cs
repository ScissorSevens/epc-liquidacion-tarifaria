using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementacion EF Core del repositorio de ParametrosTarifa (multi-tenant).
/// ParametrosTarifa NO es un input plano: contiene los COSTOS MEDIOS del
/// prestador (CMA, CMO, CMI, CMT, CMVIAA) que el motor tarifario usa en
/// la formula normativa. Ver Res CRA 825/2017 + 907/2019 art. 14.
/// </summary>
public class RepositorioParametrosTarifaEF : IRepositorioParametrosTarifa
{
    private readonly MediAppDbContext _db;

    public RepositorioParametrosTarifaEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ParametrosTarifa>> ListarPorPrestadorAsync(
        int idPrestador,
        CancellationToken ct = default)
        => await _db.ParametrosTarifa
            .AsNoTracking()
            .Where(p => p.IdPrestador == idPrestador)
            .OrderByDescending(p => p.Periodo)
            .ToListAsync(ct);

    public async Task<ParametrosTarifa?> BuscarPorIdAsync(int idParametros, CancellationToken ct = default)
        => await _db.ParametrosTarifa.FindAsync(new object[] { idParametros }, ct);

    public async Task<ParametrosTarifa?> BuscarVigenteAsync(
        int idPrestador,
        DateTime fecha,
        CancellationToken ct = default)
        => await _db.ParametrosTarifa
            .AsNoTracking()
            .Where(p => p.IdPrestador == idPrestador
                && p.VigenteDesde <= fecha
                && p.VigenteHasta >= fecha)
            .OrderByDescending(p => p.VigenteDesde)
            .FirstOrDefaultAsync(ct);

    public async Task<ParametrosTarifa?> BuscarPorPeriodoAsync(
        int idPrestador,
        int periodo,
        CancellationToken ct = default)
        => await _db.ParametrosTarifa
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.IdPrestador == idPrestador && p.Periodo == periodo, ct);

    public async Task<ParametrosTarifa> CrearAsync(ParametrosTarifa parametros, CancellationToken ct = default)
    {
        // Validar duplicado (mismo prestador + mismo periodo)
        var existe = await BuscarPorPeriodoAsync(parametros.IdPrestador, parametros.Periodo, ct);
        if (existe is not null)
        {
            throw new InvalidOperationException(
                $"ya existen Parametros vigentes para el prestador {parametros.IdPrestador} en el periodo {parametros.Periodo}");
        }

        parametros.CreatedAt = DateTime.UtcNow;
        _db.ParametrosTarifa.Add(parametros);
        await _db.SaveChangesAsync(ct);
        return parametros;
    }

    public async Task<ParametrosTarifa> ActualizarAsync(int idParametros, ParametrosTarifa cambios, CancellationToken ct = default)
    {
        var actual = await _db.ParametrosTarifa.FindAsync(new object[] { idParametros }, ct)
            ?? throw new InvalidOperationException($"Parametros {idParametros} no encontrado");

        // Solo vigente: no modificar si ya caduco
        if (actual.VigenteHasta < DateTime.UtcNow.Date)
        {
            throw new InvalidOperationException(
                $"No se puede modificar Parametros que ya caducaron (vigente_hasta={actual.VigenteHasta:yyyy-MM-dd})");
        }

        actual.IdAcuerdo = cambios.IdAcuerdo;
        actual.Cma = cambios.Cma;
        actual.Cmo = cambios.Cmo;
        actual.Cmi = cambios.Cmi;
        actual.Cmt = cambios.Cmt;
        actual.Cmviaa = cambios.Cmviaa;
        actual.AplicaCmviaa = cambios.AplicaCmviaa;
        actual.AguaSuministradaM3Anio = cambios.AguaSuministradaM3Anio;
        actual.IpufM3SuscriptorMes = cambios.IpufM3SuscriptorMes;
        actual.SuscriptoresPromedio = cambios.SuscriptoresPromedio;
        actual.AplicaMinimoVital = cambios.AplicaMinimoVital;
        actual.M3GratisMinimoVital = cambios.M3GratisMinimoVital;
        actual.VigenteDesde = cambios.VigenteDesde;
        actual.VigenteHasta = cambios.VigenteHasta;

        await _db.SaveChangesAsync(ct);
        return actual;
    }
}
