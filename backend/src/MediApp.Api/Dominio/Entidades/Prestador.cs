using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// Prestador (multi-tenant) del sistema. Res CRA 825/2017 art. 6:
///   - Segmento 1: prestadores con suscriptores urbanos en el rango
///     "entre 2.501 y 5.000".
///   - Segmento 2: resto (≤2.500 urbanos O rurales puros O rurales ≥50%).
///
/// id_prestador=0 está reservado para el prestador legacy "EPC-LEGACY"
/// que mantiene compatibilidad con datos preexistentes.
/// </summary>
public class Prestador
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdPrestador { get; set; }

    [Required]
    [MaxLength(50)]
    public string Codigo { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string Nit { get; set; } = string.Empty;

    /// <summary>Nombre completo del representante legal. Requerido por SSRD/SSSPD.</summary>
    [Required]
    [MaxLength(200)]
    public string RepresentanteLegal { get; set; } = string.Empty;

    /// <summary>Cédula del representante legal (6-12 dígitos). Requerido por SSRD/SSSPD.</summary>
    [Required]
    [MaxLength(12)]
    public string RepresentanteLegalCedula { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Municipio { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Departamento { get; set; } = string.Empty;

    /// <summary>1 o 2 (CHECK en EF migration). Res CRA 825/2017 art. 6.</summary>
    public short Segmento { get; set; }

    public int NumSuscriptoresUrbanos { get; set; }

    public int NumSuscriptoresRurales { get; set; }

    [MaxLength(200)]
    public string? Contacto { get; set; }

    /// <summary>"activo" | "suspendido" (soft-delete via estado).</summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "activo";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
