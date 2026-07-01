using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;
using MediApp.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Infraestructura.Repositorios;

/// <summary>
/// Implementacion EF Core del repositorio de Acuerdos Municipales.
/// Multi-tenant: 1 prestador tiene N Acuerdos historicos. Solo 1 vigente a la vez.
/// </summary>
public class RepositorioAcuerdoMunicipalEF : IRepositorioAcuerdoMunicipal
{
    private readonly MediAppDbContext _db;

    public RepositorioAcuerdoMunicipalEF(MediAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<AcuerdoMunicipal>> ListarPorPrestadorAsync(
        int idPrestador,
        CancellationToken ct = default)
        => await _db.AcuerdosMunicipales
            .AsNoTracking()
            .Where(a => a.IdPrestador == idPrestador)
            .OrderByDescending(a => a.FechaVigenciaDesde)
            .ToListAsync(ct);

    public async Task<AcuerdoMunicipal?> BuscarPorIdAsync(int idAcuerdo, CancellationToken ct = default)
        => await _db.AcuerdosMunicipales.FindAsync(new object[] { idAcuerdo }, ct);

    public async Task<AcuerdoMunicipal?> BuscarVigenteAsync(
        int idPrestador,
        DateTime fecha,
        CancellationToken ct = default)
        => await _db.AcuerdosMunicipales
            .AsNoTracking()
            .Where(a => a.IdPrestador == idPrestador
                && a.FechaVigenciaDesde <= fecha
                && a.FechaVigenciaHasta >= fecha)
            .OrderByDescending(a => a.FechaVigenciaDesde)
            .FirstOrDefaultAsync(ct);

    public async Task<AcuerdoMunicipal> CrearAsync(AcuerdoMunicipal acuerdo, CancellationToken ct = default)
    {
        // Validar solapamiento de vigencia con otros acuerdos del mismo prestador
        var solapa = await _db.AcuerdosMunicipales
            .AnyAsync(a => a.IdPrestador == acuerdo.IdPrestador
                && a.FechaVigenciaDesde <= acuerdo.FechaVigenciaHasta
                && a.FechaVigenciaHasta >= acuerdo.FechaVigenciaDesde, ct);
        if (solapa)
        {
            throw new InvalidOperationException(
                $"ya existe Acuerdo vigente en ese rango de fechas para el prestador {acuerdo.IdPrestador}");
        }

        acuerdo.CreatedAt = DateTime.UtcNow;
        _db.AcuerdosMunicipales.Add(acuerdo);
        await _db.SaveChangesAsync(ct);
        return acuerdo;
    }

    public async Task<AcuerdoMunicipal> ActualizarAsync(int idAcuerdo, AcuerdoMunicipal cambios, CancellationToken ct = default)
    {
        var actual = await _db.AcuerdosMunicipales.FindAsync(new object[] { idAcuerdo }, ct)
            ?? throw new InvalidOperationException($"Acuerdo {idAcuerdo} no encontrado");

        // No permitir update si la fecha actual ya paso la fecha_vigencia_hasta
        if (actual.FechaVigenciaHasta < DateTime.UtcNow.Date)
        {
            throw new InvalidOperationException(
                $"No se puede modificar un Acuerdo que ya paso a historico (fecha_vigencia_hasta={actual.FechaVigenciaHasta:yyyy-MM-dd})");
        }

        actual.FactorSubsidioE1 = cambios.FactorSubsidioE1;
        actual.FactorSubsidioE2 = cambios.FactorSubsidioE2;
        actual.FactorSubsidioE3 = cambios.FactorSubsidioE3;
        actual.FactorContribucionE5 = cambios.FactorContribucionE5;
        actual.FactorContribucionE6 = cambios.FactorContribucionE6;
        actual.FactorContribucionComercial = cambios.FactorContribucionComercial;
        actual.FactorContribucionIndustrial = cambios.FactorContribucionIndustrial;
        actual.FechaVigenciaDesde = cambios.FechaVigenciaDesde;
        actual.FechaVigenciaHasta = cambios.FechaVigenciaHasta;
        actual.ActoAdministrativoUrl = cambios.ActoAdministrativoUrl;
        actual.Observaciones = cambios.Observaciones;

        await _db.SaveChangesAsync(ct);
        return actual;
    }
}
