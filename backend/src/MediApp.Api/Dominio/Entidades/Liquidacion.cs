using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// Liquidación tarifaria CRA derivada de una Lectura. Cada Lectura tiene a lo sumo
/// una Liquidación (FK unique).
/// </summary>
public class Liquidacion
{
    [Key]
    public int Id { get; set; }

    public int IdLectura { get; set; }

    [ForeignKey(nameof(IdLectura))]
    public Lectura? Lectura { get; set; }

    [Column(TypeName = "numeric(12,3)")]
    public decimal ConsumoM3 { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal CargoFijo { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal CargoBasico { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal CargoExcedente { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal Subsidio { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal Contribucion { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal Total { get; set; }

    /// <summary>Estrato 1..6 al momento de la liquidación (puede diferir del actual).</summary>
    public short Estrato { get; set; }

    /// <summary>Identificador del cliente offline. Formato `dispositivo:id_local`.</summary>
    [Required]
    [MaxLength(120)]
    public string IdCliente { get; set; } = string.Empty;

    /// <summary>FK al prestador (multi-tenant, denormalizado). NOT NULL DEFAULT 0 legacy.</summary>
    public int IdPrestador { get; set; } = 0;

    [ForeignKey(nameof(IdPrestador))]
    public Prestador? Prestador { get; set; }
}
