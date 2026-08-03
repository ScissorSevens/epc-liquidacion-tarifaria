using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// Medidor fisico de agua asociado a un Suscriptor. Espejo de la entidad del dominio
/// mobile (src/medidores/types.ts). El IdCliente es el identificador offline del mobile
/// (`dispositivo:id_local`) y es unico globalmente para idempotencia.
/// </summary>
public class Medidor
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Numero del medidor estampado en el aparato. Espejo de `numero_medidor` del dominio.
    /// Regex `^[A-Za-z0-9-]{1,50}$` (validado en el payload).
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string NumeroMedidor { get; set; } = string.Empty;

    public int IdSuscriptor { get; set; }

    [ForeignKey(nameof(IdSuscriptor))]
    public Suscriptor? Suscriptor { get; set; }

    /// <summary>
    /// Fecha de instalacion en formato ISO 8601 date (YYYY-MM-DD). String, igual que el
    /// dominio mobile (`fecha_instalacion`).
    /// </summary>
    [Required]
    [MaxLength(10)]
    public string FechaInstalacion { get; set; } = string.Empty;

    /// <summary>Valores esperados: "activo" | "inactivo" | "reemplazado".</summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "activo";

    /// <summary>Observaciones libres (opcional, hasta 500 chars).</summary>
    [MaxLength(500)]
    public string? Observaciones { get; set; }

    /// <summary>Identificador del cliente offline. Formato `dispositivo:id_local`.</summary>
    [Required]
    [MaxLength(120)]
    public string IdCliente { get; set; } = string.Empty;
}
