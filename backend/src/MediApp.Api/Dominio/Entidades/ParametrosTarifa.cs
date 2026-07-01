using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// ParametrosTarifa del prestador para un periodo (Res 825/2017:
/// periodo = 5 años). El motor usa estos insumos + AcuerdoMunicipal
/// para calcular CF, CC unitario y aplicar topes.
///
/// NO es un input plano: contiene los COSTOS MEDIOS (CMA, CMO, CMI,
/// CMT, CMVIAA) que el motor usa en la formula normativa.
/// </summary>
public class ParametrosTarifa
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdParametros { get; set; }

    public int IdPrestador { get; set; }

    [ForeignKey(nameof(IdPrestador))]
    public Prestador? Prestador { get; set; }

    public int IdAcuerdo { get; set; }

    [ForeignKey(nameof(IdAcuerdo))]
    public AcuerdoMunicipal? Acuerdo { get; set; }

    public int Periodo { get; set; }

    // Costos medios
    public double Cma { get; set; }  // pesos/año
    public double Cmo { get; set; }  // pesos/m³
    public double Cmi { get; set; }  // pesos/m³
    public double Cmt { get; set; }  // pesos/m³
    public double Cmviaa { get; set; }  // pesos/m³ (Art. 14 Res 907/2019)
    public bool AplicaCmviaa { get; set; }

    // Agua
    public double AguaSuministradaM3Anio { get; set; }
    public double IpufM3SuscriptorMes { get; set; } = 6;
    public int SuscriptoresPromedio { get; set; }

    // Mínimo vital
    public bool AplicaMinimoVital { get; set; }
    public int M3GratisMinimoVital { get; set; }

    public DateTime VigenteDesde { get; set; }
    public DateTime VigenteHasta { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
