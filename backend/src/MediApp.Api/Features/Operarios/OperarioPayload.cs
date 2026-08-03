using System.Text.Json.Serialization;

namespace MediApp.Api.Features.Operarios;

/// <summary>
/// Payload para creación de un operario. Todos los campos requeridos excepto DispositivoId.
/// El campo PasswordHash debe venir pre-hasheado con bcrypt desde el cliente.
/// </summary>
public class OperarioPayload
{
    [JsonPropertyName("numeroCedula")]
    public string NumeroCedula { get; set; } = string.Empty;

    [JsonPropertyName("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    /// <summary>Hash bcrypt generado en el cliente (costo 10). NUNCA la contraseña en claro.</summary>
    [JsonPropertyName("passwordHash")]
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>Valores válidos: "operario" | "supervisor" | "admin". Default: "operario".</summary>
    [JsonPropertyName("rol")]
    public string Rol { get; set; } = "operario";

    /// <summary>Valores válidos: "activo" | "inactivo". Default: "activo".</summary>
    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "activo";

    [JsonPropertyName("dispositivoId")]
    public string? DispositivoId { get; set; }

    /// <summary>Fecha de creación en ISO 8601 (string). Espejo del dominio mobile.</summary>
    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = string.Empty;

    /// <summary>
    /// FK a Prestador (multi-tenant). Default 0 = prestador legacy "EPC-LEGACY".
    /// SDD: setup-inicial-multi-tenant-auth phase 3 task 3.4.
    /// </summary>
    [JsonPropertyName("id_prestador")]
    public int IdPrestador { get; set; }
}

/// <summary>
/// Payload para vincular un dispositivo móvil a un operario.
/// Requiere cédula + contraseña en claro para verificar identidad antes de vincular.
/// </summary>
public class VincularDispositivoPayload
{
    [JsonPropertyName("cedula")]
    public string Cedula { get; set; } = string.Empty;

    /// <summary>Contraseña en claro. Se verifica contra el hash bcrypt almacenado.</summary>
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [JsonPropertyName("dispositivoId")]
    public string DispositivoId { get; set; } = string.Empty;
}
