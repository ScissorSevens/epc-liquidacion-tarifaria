using System.ComponentModel.DataAnnotations;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// Suscriptor de servicios. Espejo de la entidad del dominio mobile
/// (src/suscriptores/types.ts). Naming snake_case en DB se aplica via
/// UseSnakeCaseNamingConvention.
/// </summary>
public class Suscriptor
{
    [Key]
    public int Id { get; set; }

    /// <summary>Codigo del suscriptor (1-10 digitos). Espejo de `codigo` del dominio.</summary>
    [Required]
    [MaxLength(10)]
    public string Codigo { get; set; } = string.Empty;

    /// <summary>Nombre y apellidos completos. Espejo de `nombre_apellidos` del dominio.</summary>
    [Required]
    [MaxLength(150)]
    public string NombreApellidos { get; set; } = string.Empty;

    /// <summary>Direccion del suscriptor. REQUERIDA segun dominio mobile.</summary>
    [Required]
    [MaxLength(200)]
    public string Direccion { get; set; } = string.Empty;

    /// <summary>Estrato socioeconomico colombiano: 1..6.</summary>
    public short Estrato { get; set; }

    /// <summary>Matricula inmobiliaria (opcional, hasta 50 chars).</summary>
    [MaxLength(50)]
    public string? MatriculaInmobiliaria { get; set; }

    /// <summary>Numero catastral (opcional, hasta 50 chars).</summary>
    [MaxLength(50)]
    public string? NumeroCatastral { get; set; }

    /// <summary>Valores esperados: "activo" | "inactivo" | "suspendido".</summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "activo";

    /// <summary>
    /// Fecha de creacion en formato ISO 8601 (string, espejo de `created_at` del dominio).
    /// El dominio mobile maneja fechas como string ISO; el backend las persiste igual para
    /// que el round-trip sea exacto.
    /// </summary>
    [Required]
    [MaxLength(40)]
    public string CreatedAt { get; set; } = string.Empty;

    /// <summary>Identificador del cliente offline. Formato `dispositivo:id_local`.</summary>
    [Required]
    [MaxLength(120)]
    public string IdCliente { get; set; } = string.Empty;

    /// <summary>Cedula del suscriptor (nullable — retrocompatibilidad con registros previos).</summary>
    [MaxLength(20)]
    public string? Cedula { get; set; }

    /// <summary>Municipio del suscriptor (nullable — retrocompatibilidad con registros previos).</summary>
    [MaxLength(100)]
    public string? Municipio { get; set; }

    /// <summary>Sector del suscriptor (nullable — retrocompatibilidad con registros previos).</summary>
    [MaxLength(100)]
    public string? Sector { get; set; }

    /// <summary>Indica si aplica subsidio tarifario (nullable — retrocompatibilidad con registros previos).</summary>
    public bool? AplicaSubsidio { get; set; }
}
