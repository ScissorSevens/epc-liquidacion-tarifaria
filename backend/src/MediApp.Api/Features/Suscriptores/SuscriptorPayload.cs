using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Suscriptores;

/// <summary>
/// Espejo del payload de Suscriptor que postea el mobile (8 campos del modelo offline).
/// Campos en camelCase para matchear el JSON del cliente.
/// </summary>
public class SuscriptorPayload
{
    [JsonPropertyName("documento")]
    public string Documento { get; set; } = string.Empty;

    [JsonPropertyName("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [JsonPropertyName("direccion")]
    public string? Direccion { get; set; }

    [JsonPropertyName("estrato")]
    public short Estrato { get; set; }

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "activo";

    [JsonPropertyName("fechaAlta")]
    public DateTimeOffset FechaAlta { get; set; }

    /// <summary>idCliente offline. Debe coincidir con el del sobre SyncRequest.</summary>
    [JsonPropertyName("idCliente")]
    public string IdCliente { get; set; } = string.Empty;
}
