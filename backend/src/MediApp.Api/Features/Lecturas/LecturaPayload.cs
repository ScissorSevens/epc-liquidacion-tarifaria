using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Lecturas;

/// <summary>
/// Payload de Lectura que postea el mobile. La FK al Medidor se expresa por su
/// <c>idCliente</c>. La evidencia foto viene embebida en base64 (con su MIME)
/// y el server la persiste vía <c>IAlmacenEvidencias</c>; la ruta resuelta se
/// asigna en <see cref="EvidenciaFotoRutaResuelta"/> antes del mapeo a entidad.
/// </summary>
public class LecturaPayload
{
    /// <summary>idCliente del Medidor dueño de la lectura (FK lógica).</summary>
    [JsonPropertyName("idMedidorCliente")]
    public string IdMedidorCliente { get; set; } = string.Empty;

    [JsonPropertyName("lecturaActual")]
    public decimal LecturaActual { get; set; }

    [JsonPropertyName("lecturaAnterior")]
    public decimal LecturaAnterior { get; set; }

    /// <summary>Período en formato `YYYYMM`.</summary>
    [JsonPropertyName("periodo")]
    public string Periodo { get; set; } = string.Empty;

    [JsonPropertyName("idOperario")]
    public int IdOperario { get; set; }

    [JsonPropertyName("timestampCaptura")]
    public DateTimeOffset TimestampCaptura { get; set; }

    [JsonPropertyName("observaciones")]
    public string? Observaciones { get; set; }

    /// <summary>Foto en base64 puro (sin prefijo data:); nullable.</summary>
    [JsonPropertyName("evidenciaFotoBase64")]
    public string? EvidenciaFotoBase64 { get; set; }

    /// <summary>MIME type asociado a la foto (ej. "image/jpeg"). Requerido si hay base64.</summary>
    [JsonPropertyName("evidenciaFotoMime")]
    public string? EvidenciaFotoMime { get; set; }

    /// <summary>SHA-256 hex (64 chars) calculado en el mobile sobre los bytes originales de la foto.</summary>
    [JsonPropertyName("evidenciaFotoHash")]
    public string? EvidenciaFotoHash { get; set; }

    /// <summary>idCliente offline de la propia Lectura.</summary>
    [JsonPropertyName("idCliente")]
    public string IdCliente { get; set; } = string.Empty;

    /// <summary>
    /// Ruta relativa donde el almacén guardó la foto. Lo asigna el preProcess del endpoint
    /// (no viene del mobile). El mapper la lee al armar la entidad.
    /// </summary>
    [JsonIgnore]
    public string? EvidenciaFotoRutaResuelta { get; set; }
}
