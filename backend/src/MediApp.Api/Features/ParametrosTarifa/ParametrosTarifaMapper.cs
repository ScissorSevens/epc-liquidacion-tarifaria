using MediApp.Api.Dominio.Entidades;
using EntidadParametrosTarifa = MediApp.Api.Dominio.Entidades.ParametrosTarifa;

namespace MediApp.Api.Features.ParametrosTarifa;

public static class ParametrosTarifaMapper
{
    public static EntidadParametrosTarifa PayloadAEntidad(ParametrosTarifaPayload p) => new()
    {
        IdPrestador = p.IdPrestador,
        IdAcuerdo = p.IdAcuerdo,
        Periodo = p.Periodo,
        Cma = p.Cma,
        Cmo = p.Cmo,
        Cmi = p.Cmi,
        Cmt = p.Cmt,
        Cmviaa = p.Cmviaa,
        AplicaCmviaa = p.AplicaCmviaa,
        AguaSuministradaM3Anio = p.AguaSuministradaM3Anio,
        IpufM3SuscriptorMes = p.IpufM3SuscriptorMes,
        SuscriptoresPromedio = p.SuscriptoresPromedio,
        AplicaMinimoVital = p.AplicaMinimoVital,
        M3GratisMinimoVital = p.M3GratisMinimoVital,
        VigenteDesde = p.VigenteDesde,
        VigenteHasta = p.VigenteHasta,
    };

    public static void AplicarPayload(ParametrosTarifaPayload p, EntidadParametrosTarifa entidad)
    {
        entidad.IdAcuerdo = p.IdAcuerdo;
        entidad.Cma = p.Cma;
        entidad.Cmo = p.Cmo;
        entidad.Cmi = p.Cmi;
        entidad.Cmt = p.Cmt;
        entidad.Cmviaa = p.Cmviaa;
        entidad.AplicaCmviaa = p.AplicaCmviaa;
        entidad.AguaSuministradaM3Anio = p.AguaSuministradaM3Anio;
        entidad.IpufM3SuscriptorMes = p.IpufM3SuscriptorMes;
        entidad.SuscriptoresPromedio = p.SuscriptoresPromedio;
        entidad.AplicaMinimoVital = p.AplicaMinimoVital;
        entidad.M3GratisMinimoVital = p.M3GratisMinimoVital;
        entidad.VigenteDesde = p.VigenteDesde;
        entidad.VigenteHasta = p.VigenteHasta;
    }
}
