using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Features.AcuerdosMunicipales;

public static class AcuerdoMunicipalMapper
{
    public static AcuerdoMunicipal PayloadAEntidad(AcuerdoMunicipalPayload p) => new()
    {
        IdPrestador = p.IdPrestador,
        FactorSubsidioE1 = p.FactorSubsidioE1,
        FactorSubsidioE2 = p.FactorSubsidioE2,
        FactorSubsidioE3 = p.FactorSubsidioE3,
        FactorContribucionE5 = p.FactorContribucionE5,
        FactorContribucionE6 = p.FactorContribucionE6,
        FactorContribucionComercial = p.FactorContribucionComercial,
        FactorContribucionIndustrial = p.FactorContribucionIndustrial,
        FechaVigenciaDesde = p.FechaVigenciaDesde,
        FechaVigenciaHasta = p.FechaVigenciaHasta,
        ActoAdministrativoUrl = p.ActoAdministrativoUrl,
        Observaciones = p.Observaciones,
    };

    public static void AplicarPayload(AcuerdoMunicipalPayload p, AcuerdoMunicipal entidad)
    {
        entidad.FactorSubsidioE1 = p.FactorSubsidioE1;
        entidad.FactorSubsidioE2 = p.FactorSubsidioE2;
        entidad.FactorSubsidioE3 = p.FactorSubsidioE3;
        entidad.FactorContribucionE5 = p.FactorContribucionE5;
        entidad.FactorContribucionE6 = p.FactorContribucionE6;
        entidad.FactorContribucionComercial = p.FactorContribucionComercial;
        entidad.FactorContribucionIndustrial = p.FactorContribucionIndustrial;
        entidad.FechaVigenciaDesde = p.FechaVigenciaDesde;
        entidad.FechaVigenciaHasta = p.FechaVigenciaHasta;
        entidad.ActoAdministrativoUrl = p.ActoAdministrativoUrl;
        entidad.Observaciones = p.Observaciones;
    }
}
