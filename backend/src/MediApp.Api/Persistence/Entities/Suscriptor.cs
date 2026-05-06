using System.ComponentModel.DataAnnotations;

namespace MediApp.Api.Persistence.Entities;

/// <summary>
/// Suscriptor de servicios. Día 1: entidad mínima para validar pipeline EF + snake_case.
/// Día 2 amplía campos (matricula, catastral, etc.) y se reconcilia con el dominio mobile.
/// </summary>
public class Suscriptor
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Documento { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Direccion { get; set; }

    /// <summary>Estrato socioeconómico colombiano: 1..6.</summary>
    public short Estrato { get; set; }

    /// <summary>Valores esperados: "activo" | "inactivo" | "suspendido".</summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "activo";

    /// <summary>Mapeado a `timestamp with time zone` por Npgsql.</summary>
    public DateTimeOffset FechaAlta { get; set; }

    /// <summary>Identificador del cliente offline. Formato `dispositivo:id_local`.</summary>
    [Required]
    [MaxLength(120)]
    public string IdCliente { get; set; } = string.Empty;
}
