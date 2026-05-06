using System.ComponentModel.DataAnnotations;

namespace MediApp.Api.Persistence.Entities;

/// <summary>
/// Registro auxiliar de sincronización. Sirve para idempotencia y detección de conflicto
/// sin tener que leer la entidad de negocio: dado (IdCliente, Tipo) sabemos qué Id server
/// le corresponde y cuál fue el HashServer aceptado la última vez.
/// </summary>
public class SyncRegistro
{
    [Key]
    public int Id { get; set; }

    /// <summary>Identificador del cliente offline. Formato `dispositivo:id_local`.</summary>
    [Required]
    [MaxLength(120)]
    public string IdCliente { get; set; } = string.Empty;

    /// <summary>Uno de: "suscriptor" | "medidor" | "lectura" | "liquidacion".</summary>
    [Required]
    [MaxLength(20)]
    public string Tipo { get; set; } = string.Empty;

    /// <summary>SHA-256 hex (64 chars) del payload aceptado.</summary>
    [Required]
    [MaxLength(64)]
    public string HashServer { get; set; } = string.Empty;

    /// <summary>FK lógica al Id server de la entidad de negocio (no enforced por DB).</summary>
    public int IdEntidad { get; set; }

    /// <summary>Mapeado a `timestamp with time zone` por Npgsql.</summary>
    public DateTimeOffset FechaSync { get; set; }
}
