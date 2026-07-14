using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Liquidaciones;

/// <summary>
/// Payload de Liquidación que postea el mobile. La FK a la Lectura se expresa por su
/// <c>idCliente</c>; el endpoint resuelve el Id server contra <c>sync_registros</c>.
/// </summary>
public class LiquidacionPayload
{
    /// <summary>idCliente de la Lectura origen de la liquidación (FK lógica).</summary>
    [JsonPropertyName("idLecturaCliente")]
    public string IdLecturaCliente { get; set; } = string.Empty;

    [JsonPropertyName("consumoM3")]
    public decimal ConsumoM3 { get; set; }

    [JsonPropertyName("cargoFijo")]
    public decimal CargoFijo { get; set; }

    [JsonPropertyName("cargoBasico")]
    public decimal CargoBasico { get; set; }

    [JsonPropertyName("cargoExcedente")]
    public decimal CargoExcedente { get; set; }

    [JsonPropertyName("subsidio")]
    public decimal Subsidio { get; set; }

    [JsonPropertyName("contribucion")]
    public decimal Contribucion { get; set; }

    [JsonPropertyName("total")]
    public decimal Total { get; set; }

    [JsonPropertyName("estrato")]
    public short Estrato { get; set; }

    /// <summary>idCliente offline de la propia Liquidación.</summary>
    [JsonPropertyName("idCliente")]
    public string IdCliente { get; set; } = string.Empty;

    /// <summary>
    /// FK al prestador (multi-tenant, denormalizado). Requerido en nuevas
    /// versiones del cliente mobile (cambio motor-tarifario-cra-825-2017-
    /// multitenant). Mobile v1 puede NO enviarlo; en ese caso el backend
    /// asume id_prestador=0 (EPC-LEGACY).
    /// </summary>
    [JsonPropertyName("idPrestador")]
    public int IdPrestador { get; set; } = 0;
}
