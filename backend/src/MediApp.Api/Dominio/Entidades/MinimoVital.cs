using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// Mínimo vital del prestador — tabla relacionada 1:1 con prestador.
///
/// Se separa de ParametrosTarifa por 3 razones (decisión del user):
///   1. Vigencia independiente: el minimo vital puede cambiar dentro
///      de un periodo tarifario (ej: Acuerdo Municipal nuevo).
///   2. Estratos aplicables: un prestador puede dar minimo vital solo
///      a estratos 1, 2, 3 (subsidiables segun L142/1994).
///   3. Opcional: no todos los prestadores configuran minimo vital.
///
/// Multi-tenant: cada prestador tiene como maximo UN minimo vital
/// vigente en cualquier momento. UNIQUE (id_prestador, vigente_desde).
/// </summary>
public class MinimoVital
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdMinimoVital { get; set; }

    public int IdPrestador { get; set; }

    [ForeignKey(nameof(IdPrestador))]
    public Prestador? Prestador { get; set; }

    /// <summary>
    /// Metros cubicos gratis por suscriptor / mes. Default 6 (norma).
    /// NULL = "aplica a TODO el consumo" (caso edge).
    /// </summary>
    public int? MetrosCubicos { get; set; }

    /// <summary>
    /// Estratos socioeconomicos a los que aplica el minimo vital.
    /// Segun L142/1994 art. 99.1, los prestadores pueden optar por
    /// subsidiar estratos 1, 2, 3. Array vacio = "todos los estratos".
    /// Se persiste como JSONB en PostgreSQL.
    /// </summary>
    [Column(TypeName = "jsonb")]
    public int[] EstratosAplica { get; set; } = Array.Empty<int>();

    public DateTime VigenteDesde { get; set; }
    public DateTime VigenteHasta { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
