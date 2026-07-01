using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Prestadores;

/// <summary>
/// Payload de Prestador (multi-tenant). Usado por POST/PUT.
/// snake_case en JSON segun UseSnakeCaseNamingConvention del Program.cs.
/// </summary>
public class PrestadorPayload
{
    [JsonPropertyName("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [JsonPropertyName("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [JsonPropertyName("nit")]
    public string Nit { get; set; } = string.Empty;

    [JsonPropertyName("municipio")]
    public string Municipio { get; set; } = string.Empty;

    [JsonPropertyName("departamento")]
    public string Departamento { get; set; } = string.Empty;

    /// <summary>1 o 2 (Res CRA 825/2017 art. 6).</summary>
    [JsonPropertyName("segmento")]
    public short Segmento { get; set; }

    [JsonPropertyName("num_suscriptores_urbanos")]
    public int NumSuscriptoresUrbanos { get; set; }

    [JsonPropertyName("num_suscriptores_rurales")]
    public int NumSuscriptoresRurales { get; set; }

    [JsonPropertyName("contacto")]
    public string? Contacto { get; set; }

    /// <summary>"activo" | "suspendido" (soft-delete). Default "activo".</summary>
    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "activo";
}
