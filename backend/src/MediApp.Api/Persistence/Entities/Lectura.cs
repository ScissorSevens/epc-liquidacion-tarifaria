using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Persistence.Entities;

/// <summary>
/// Lectura tomada de un medidor en un período (YYYYMM). Puede tener evidencia fotográfica
/// asociada, persistida vía <see cref="Infrastructure.Almacen.IAlmacenEvidencias"/>.
/// </summary>
public class Lectura
{
    [Key]
    public int Id { get; set; }

    public int IdMedidor { get; set; }

    [ForeignKey(nameof(IdMedidor))]
    public Medidor? Medidor { get; set; }

    [Column(TypeName = "numeric(12,3)")]
    public decimal LecturaActual { get; set; }

    [Column(TypeName = "numeric(12,3)")]
    public decimal LecturaAnterior { get; set; }

    /// <summary>Período en formato `YYYYMM` (ej. "202605"). Fixed length 6.</summary>
    [Required]
    [MaxLength(6)]
    [Column(TypeName = "char(6)")]
    public string Periodo { get; set; } = string.Empty;

    public int? IdOperario { get; set; }

    [ForeignKey(nameof(IdOperario))]
    public Operario? Operario { get; set; }

    /// <summary>Mapeado a `timestamp with time zone` por Npgsql.</summary>
    public DateTimeOffset TimestampCaptura { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

    /// <summary>Ruta relativa del archivo de evidencia, asignada por IAlmacenEvidencias.</summary>
    [MaxLength(300)]
    public string? EvidenciaFotoRuta { get; set; }

    /// <summary>SHA-256 hex (64 chars) de la evidencia, calculado en el mobile.</summary>
    [MaxLength(64)]
    public string? EvidenciaFotoHash { get; set; }

    /// <summary>Identificador del cliente offline. Formato `dispositivo:id_local`.</summary>
    [Required]
    [MaxLength(120)]
    public string IdCliente { get; set; } = string.Empty;
}
