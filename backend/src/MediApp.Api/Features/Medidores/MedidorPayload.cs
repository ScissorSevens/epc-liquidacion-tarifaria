using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Medidores;

/// <summary>
/// Payload de Medidor que postea el mobile. La FK al Suscriptor se expresa por su
/// <c>idCliente</c> (formato `dispositivo:id_local`) en lugar del Id server: el endpoint
/// resuelve el FK contra <c>sync_registros</c>.
/// </summary>
public class MedidorPayload
{
    [JsonPropertyName("codigo")]
    public string Codigo { get; set; } = string.Empty;

    /// <summary>idCliente del Suscriptor dueño del medidor (FK lógica).</summary>
    [JsonPropertyName("idSuscriptorCliente")]
    public string IdSuscriptorCliente { get; set; } = string.Empty;

    [JsonPropertyName("fechaInstalacion")]
    public DateTimeOffset FechaInstalacion { get; set; }

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "activo";

    /// <summary>idCliente offline del propio Medidor.</summary>
    [JsonPropertyName("idCliente")]
    public string IdCliente { get; set; } = string.Empty;
}
