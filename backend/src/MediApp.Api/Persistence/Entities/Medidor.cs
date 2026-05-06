using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Persistence.Entities;

/// <summary>
/// Medidor físico de agua asociado a un Suscriptor. El IdCliente es el identificador
/// offline del mobile (`dispositivo:id_local`) y es único globalmente para idempotencia.
/// </summary>
public class Medidor
{
    [Key]
    public int Id { get; set; }

    /// <summary>Código del medidor estampado en el aparato (ej. serial del fabricante).</summary>
    [Required]
    [MaxLength(80)]
    public string Codigo { get; set; } = string.Empty;

    public int IdSuscriptor { get; set; }

    [ForeignKey(nameof(IdSuscriptor))]
    public Suscriptor? Suscriptor { get; set; }

    /// <summary>Mapeado a `timestamp with time zone` por Npgsql.</summary>
    public DateTimeOffset FechaInstalacion { get; set; }

    /// <summary>Valores esperados: "activo" | "retirado" | "danado".</summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "activo";

    /// <summary>Identificador del cliente offline. Formato `dispositivo:id_local`.</summary>
    [Required]
    [MaxLength(120)]
    public string IdCliente { get; set; } = string.Empty;
}
