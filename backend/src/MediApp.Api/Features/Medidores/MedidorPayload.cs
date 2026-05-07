using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Medidores;

/// <summary>
/// Payload de Medidor que postea el mobile. La FK al Suscriptor se expresa por su
/// <c>idCliente</c> (formato `dispositivo:id_local`) en lugar del Id server: el endpoint
/// resuelve el FK contra <c>sync_registros</c>.
/// FUENTE DE VERDAD: src/medidores/types.ts del dominio mobile.
/// </summary>
public class MedidorPayload
{
    [JsonPropertyName("numeroMedidor")]
    public string NumeroMedidor { get; set; } = string.Empty;

    /// <summary>idCliente del Suscriptor dueno del medidor (FK logica, formato `dispositivo:id_local`).</summary>
    [JsonPropertyName("idSuscriptorCliente")]
    public string IdSuscriptorCliente { get; set; } = string.Empty;

    /// <summary>Fecha de instalacion ISO date (YYYY-MM-DD). String, no DateTimeOffset.</summary>
    [JsonPropertyName("fechaInstalacion")]
    public string FechaInstalacion { get; set; } = string.Empty;

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "activo";

    [JsonPropertyName("observaciones")]
    public string? Observaciones { get; set; }

    /// <summary>idCliente offline del propio Medidor.</summary>
    [JsonPropertyName("idCliente")]
    public string IdCliente { get; set; } = string.Empty;
}
