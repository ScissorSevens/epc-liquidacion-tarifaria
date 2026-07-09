using System.ComponentModel.DataAnnotations;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// Operario del sistema. Espejo de src/operarios/types.ts.
/// Naming snake_case en DB vía UseSnakeCaseNamingConvention.
/// </summary>
public class Operario
{
    [Key]
    public int Id { get; set; }

    /// <summary>6-12 dígitos. UNIQUE en DB.</summary>
    [Required]
    [MaxLength(12)]
    public string NumeroCedula { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    /// <summary>Formato email. UNIQUE en DB.</summary>
    [Required]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    /// <summary>bcrypt hash (máx 200 chars cubre $2b$ format).</summary>
    [Required]
    [MaxLength(200)]
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>Valores: "operario" | "supervisor" | "admin".</summary>
    [Required]
    [MaxLength(20)]
    public string Rol { get; set; } = "operario";

    /// <summary>Valores: "activo" | "inactivo". Soft-delete via inactivo.</summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "activo";

    /// <summary>ID del dispositivo mobile asignado. UNIQUE nullable.</summary>
    [MaxLength(100)]
    public string? DispositivoId { get; set; }

    /// <summary>ISO 8601 string. Espejo del dominio TS.</summary>
    [Required]
    [MaxLength(40)]
    public string CreatedAt { get; set; } = string.Empty;

    /// <summary>
    /// FK a Prestador (multi-tenant). Default 0 = prestador legacy "EPC-LEGACY"
    /// (id_prestador=0) que mantiene compatibilidad con datos preexistentes.
    /// Restricción: ON DELETE RESTRICT — un prestador con operarios no se puede eliminar.
    /// SDD: setup-inicial-multi-tenant-auth phase 3 task 3.4.
    /// </summary>
    public int IdPrestador { get; set; }

    /// <summary>
    /// Navigation property opcional. Null cuando el operario se carga sin
    /// eager-loading de Prestador.
    /// </summary>
    public Prestador? Prestador { get; set; }
}
