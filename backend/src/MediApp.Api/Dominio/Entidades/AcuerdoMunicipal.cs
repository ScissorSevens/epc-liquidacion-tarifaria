using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// Acuerdo Municipal tipado (Q6 spec) — define los topes de
/// subsidio/contribución que aplican al prestador.
///
/// El motor CAPEA al tope nacional L142/1994 art. 99.6 al momento
/// del cálculo. Ver <c>LiquidacionValidator</c>.
/// </summary>
public class AcuerdoMunicipal
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdAcuerdo { get; set; }

    public int IdPrestador { get; set; }

    [ForeignKey(nameof(IdPrestador))]
    public Prestador? Prestador { get; set; }

    /// <summary>Negativo. Rango legal L142: [-1.0, -0.60].</summary>
    public double FactorSubsidioE1 { get; set; }

    public double FactorSubsidioE2 { get; set; }
    public double FactorSubsidioE3 { get; set; }
    public double FactorContribucionE5 { get; set; }
    public double FactorContribucionE6 { get; set; }
    public double FactorContribucionComercial { get; set; } = 0.50;
    public double FactorContribucionIndustrial { get; set; } = 0.30;

    public DateTime FechaVigenciaDesde { get; set; }
    public DateTime FechaVigenciaHasta { get; set; }

    [MaxLength(500)]
    public string? ActoAdministrativoUrl { get; set; }

    [MaxLength(2000)]
    public string? Observaciones { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
