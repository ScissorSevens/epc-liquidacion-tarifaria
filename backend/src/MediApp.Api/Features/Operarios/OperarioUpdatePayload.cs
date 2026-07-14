using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Operarios;

/// <summary>
/// Payload para actualización parcial de un operario (PUT).
/// Todos los campos son opcionales; solo los no-null se aplican.
/// NumeroCedula es INMUTABLE y está excluido intencionalmente.
/// </summary>
public class OperarioUpdatePayload
{
    [JsonPropertyName("nombre")]
    public string? Nombre { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    /// <summary>Hash bcrypt generado en el cliente. Null = no cambiar la contraseña.</summary>
    [JsonPropertyName("passwordHash")]
    public string? PasswordHash { get; set; }

    [JsonPropertyName("rol")]
    public string? Rol { get; set; }

    [JsonPropertyName("estado")]
    public string? Estado { get; set; }

    [JsonPropertyName("dispositivoId")]
    public string? DispositivoId { get; set; }

    /// <summary>
    /// FK a Prestador (multi-tenant). Null = no cambiar el prestador asignado.
    /// SDD: setup-inicial-multi-tenant-auth phase 3 task 3.4.
    /// </summary>
    [JsonPropertyName("id_prestador")]
    public int? IdPrestador { get; set; }
}
