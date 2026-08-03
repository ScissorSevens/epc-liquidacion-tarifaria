using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MediApp.Api.Dominio.Entidades;

/// <summary>
/// ParametrosTarifa del prestador para un periodo (Res 825/2017:
/// periodo = 5 años). El motor usa estos insumos + AcuerdoMunicipal
/// para calcular CF, CC unitario y aplicar topes.
///
/// NO es un input plano: contiene los COSTOS MEDIOS (CMA, CMO, CMI,
/// CMT, CMVIAA) que el motor usa en la formula normativa.
///
/// Compliance Res 825/2017 (4 puntos):
///   - ipuf_indice: precio al usuario final (multiplicador periodico).
///   - cargo_fijo_resultante + cargo_consumo_resultante: pre-calculados
///     al guardar (= CMA/N / = CMO+CMI+CMT+CMVIAA). PERSISTIDOS. No se
///     recalculan en cada factura (decoupling metodologico).
///   - componentes_aplicables: array JSON de IDs de componentes activos.
///   - minimo_vital: tabla RELACIONADA 1:1 con prestador, con su PROPIA
///     vigencia. Opcional (no se embebe en esta entidad).
/// </summary>
public class ParametrosTarifa
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int IdParametros { get; set; }

    public int IdPrestador { get; set; }

    [ForeignKey(nameof(IdPrestador))]
    public Prestador? Prestador { get; set; }

    public int IdAcuerdo { get; set; }

    [ForeignKey(nameof(IdAcuerdo))]
    public AcuerdoMunicipal? Acuerdo { get; set; }

    public int Periodo { get; set; }

    // Costos medios
    public double Cma { get; set; }  // pesos/año
    public double Cmo { get; set; }  // pesos/m³
    public double Cmi { get; set; }  // pesos/m³
    public double Cmt { get; set; }  // pesos/m³
    public double Cmviaa { get; set; }  // pesos/m³ (Art. 14 Res 907/2019)
    public bool AplicaCmviaa { get; set; }

    // Agua
    public double AguaSuministradaM3Anio { get; set; }
    public double IpufM3SuscriptorMes { get; set; } = 6;
    public int SuscriptoresPromedio { get; set; }

    // Mínimo vital — flag legacy (la fuente de verdad es la tabla
    // relacionada MinimoVital). Se conserva por backward-compat con
    // data pre-Migration.
    public bool AplicaMinimoVital { get; set; }
    public int M3GratisMinimoVital { get; set; }

    /// <summary>
    /// Índice de Precios al Usuario Final. Multiplicador periódico para
    /// actualizar precios sin re-emitir la metodología tarifaria.
    /// Default 1.0 (sin ajuste). 1.05 = 5% de incremento.
    /// </summary>
    public double IpufIndice { get; set; } = 1.0;

    /// <summary>
    /// Cargo fijo resultado (COP / suscriptor / mes). PRE-CALCULADO al
    /// guardar (= CMA / N si CMA está en componentes_aplicables).
    /// PERSISTIDO. Decoupling: si la metodología cambia, las facturas
    /// NO se invalidan.
    /// </summary>
    public double CargoFijoResultante { get; set; }

    /// <summary>
    /// Cargo por consumo resultado (COP / m³). PRE-CALCULADO al guardar
    /// (= CMO + CMI + CMT + CMVIAA si los componentes están activos).
    /// PERSISTIDO al idem que cargo_fijo_resultante.
    /// </summary>
    public double CargoConsumoResultante { get; set; }

    /// <summary>
    /// Componentes del modelo tarifario que están ACTIVOS para este
    /// prestador. Subset de "CMA", "CMO", "CMI", "CMT", "CMVIAA".
    /// Default vacio (la UI debe inicializar con todos los activos).
    /// </summary>
    [Column(TypeName = "jsonb")]
    public string[] ComponentesAplicables { get; set; } = Array.Empty<string>();

    public DateTime VigenteDesde { get; set; }
    public DateTime VigenteHasta { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
