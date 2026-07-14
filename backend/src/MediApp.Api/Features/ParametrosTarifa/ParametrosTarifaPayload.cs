using System.Text.Json.Serialization;

namespace MediApp.Api.Features.ParametrosTarifa;

/// <summary>
/// Payload de ParametrosTarifa. NO es un input plano: contiene los
/// COSTOS MEDIOS (CMA, CMO, CMI, CMT, CMVIAA) que el motor tarifario
/// usa en la formula normativa de Res CRA 825/2017 + 907/2019 art. 14.
/// </summary>
public class ParametrosTarifaPayload
{
    [JsonPropertyName("id_prestador")]
    public int IdPrestador { get; set; }

    [JsonPropertyName("id_acuerdo")]
    public int IdAcuerdo { get; set; }

    [JsonPropertyName("periodo")]
    public int Periodo { get; set; }

    // Costos medios
    [JsonPropertyName("cma")]
    public double Cma { get; set; }

    [JsonPropertyName("cmo")]
    public double Cmo { get; set; }

    [JsonPropertyName("cmi")]
    public double Cmi { get; set; }

    [JsonPropertyName("cmt")]
    public double Cmt { get; set; }

    [JsonPropertyName("cmviaa")]
    public double Cmviaa { get; set; }

    [JsonPropertyName("aplica_cmviaa")]
    public bool AplicaCmviaa { get; set; }

    // Agua
    [JsonPropertyName("agua_suministrada_m3_anio")]
    public double AguaSuministradaM3Anio { get; set; }

    [JsonPropertyName("ipuf_m3_suscriptor_mes")]
    public double IpufM3SuscriptorMes { get; set; } = 6;

    [JsonPropertyName("suscriptores_promedio")]
    public int SuscriptoresPromedio { get; set; }

    // Minimo vital
    [JsonPropertyName("aplica_minimo_vital")]
    public bool AplicaMinimoVital { get; set; }

    [JsonPropertyName("m3_gratis_minimo_vital")]
    public int M3GratisMinimoVital { get; set; }

    [JsonPropertyName("vigente_desde")]
    public DateTime VigenteDesde { get; set; }

    [JsonPropertyName("vigente_hasta")]
    public DateTime VigenteHasta { get; set; }
}
