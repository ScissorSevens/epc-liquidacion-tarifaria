using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Suscriptores;

/// <summary>
/// Espejo del payload de Suscriptor que postea el mobile. Campos en camelCase para
/// matchear el JSON del cliente (traduccion snake_case TS -> camelCase HTTP).
/// FUENTE DE VERDAD: src/suscriptores/types.ts del dominio mobile.
/// </summary>
public class SuscriptorPayload
{
    [JsonPropertyName("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [JsonPropertyName("nombreApellidos")]
    public string NombreApellidos { get; set; } = string.Empty;

    [JsonPropertyName("direccion")]
    public string Direccion { get; set; } = string.Empty;

    [JsonPropertyName("estrato")]
    public short Estrato { get; set; }

    [JsonPropertyName("matriculaInmobiliaria")]
    public string? MatriculaInmobiliaria { get; set; }

    [JsonPropertyName("numeroCatastral")]
    public string? NumeroCatastral { get; set; }

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "activo";

    /// <summary>Fecha de creacion en ISO 8601 (string, no DateTimeOffset). Espejo del dominio.</summary>
    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = string.Empty;

    /// <summary>idCliente offline. Debe coincidir con el del sobre SyncRequest.</summary>
    [JsonPropertyName("idCliente")]
    public string IdCliente { get; set; } = string.Empty;
}
