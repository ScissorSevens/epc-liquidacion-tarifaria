using System.Text.Json.Serialization;

namespace MediApp.Api.Features.AcuerdosMunicipales;

/// <summary>
/// Payload de AcuerdoMunicipal (Q6 spec: Acuerdo tipado, NO PDF).
/// Define los topes de subsidio/contribucion que aplican al prestador.
/// </summary>
public class AcuerdoMunicipalPayload
{
    [JsonPropertyName("id_prestador")]
    public int IdPrestador { get; set; }

    [JsonPropertyName("factor_subsidio_e1")]
    public double FactorSubsidioE1 { get; set; }

    [JsonPropertyName("factor_subsidio_e2")]
    public double FactorSubsidioE2 { get; set; }

    [JsonPropertyName("factor_subsidio_e3")]
    public double FactorSubsidioE3 { get; set; }

    [JsonPropertyName("factor_contribucion_e5")]
    public double FactorContribucionE5 { get; set; }

    [JsonPropertyName("factor_contribucion_e6")]
    public double FactorContribucionE6 { get; set; }

    [JsonPropertyName("factor_contribucion_comercial")]
    public double FactorContribucionComercial { get; set; } = 0.50;

    [JsonPropertyName("factor_contribucion_industrial")]
    public double FactorContribucionIndustrial { get; set; } = 0.30;

    [JsonPropertyName("fecha_vigencia_desde")]
    public DateTime FechaVigenciaDesde { get; set; }

    [JsonPropertyName("fecha_vigencia_hasta")]
    public DateTime FechaVigenciaHasta { get; set; }

    [JsonPropertyName("acto_administrativo_url")]
    public string? ActoAdministrativoUrl { get; set; }

    [JsonPropertyName("observaciones")]
    public string? Observaciones { get; set; }
}
