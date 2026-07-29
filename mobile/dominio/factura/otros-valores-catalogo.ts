/**
 * Catálogo hardcoded de `otros_valores` y helper de creación.
 *
 * Res CRA 1038/2026 §4 (otros conceptos a cobrar/deducir) y §10 (códigos
 * de formulario). 7 conceptos oficiales que el prestador puede aplicar
 * en la factura. Lista cerrada — si la regulación agrega uno nuevo,
 * se extiende este archivo (constante + tests).
 *
 * `SALDO_ANTERIOR` convive en este catálogo aunque se persiste en su
 * propio campo del snapshot (`saldo_anterior`) — conceptualmente
 * también es un "otro valor" (deuda de periodos previos) que el sistema
 * arrastra automaticamente, sin glosa del operario.
 *
 * Hardcoded vs tabla DB: la regulación tiene 7 conceptos estables
 * (lista cerrada). A partir de `factura-compliance-hardening` el catalogo
 * migro a la tabla SQLite `concepto_otro_valor` (versionada y auditables).
 * Esta constante queda como DEPRECATED FALLBACK para instalaciones con
 * migration 021 no aplicada (o si el repository retorna vacio).
 *
 * NO se exponen: descripcion / codigo_formulario en el objeto OtroValor
 * persistido (esos viven en el catalogo). El array persistido solo
 * guarda concepto + valor + glosa opcional.
 *
 * @deprecated Usa `ConceptoOtroValorRepository` (de `@dominio/concepto-otro-valor`)
 *             como fuente de verdad. Este constante permanece una version como
 *             fallback defensivo si el repository no esta disponible (sin
 *             bootstrap o con tabla vacia).
 */

export type ConceptoOtroValor =
  | 'SALDO_ANTERIOR'
  | 'INTERESES_AUTORIZADOS'
  | 'RECONEXION'
  | 'FINANCIACION'
  | 'MATERIALES_ACOMETIDA'
  | 'AJUSTES_DEVOLUCIONES'
  | 'OTROS_AUTORIZADOS';

export interface CatalogoOtroValor {
  readonly descripcion: string;
  readonly codigo_formulario: string;
  /** Si true, `crearOtroValor` rechaza si no se pasa glosa. */
  readonly requiere_glosa: boolean;
}

export const OtrosValoresCatalogo: Readonly<Record<ConceptoOtroValor, CatalogoOtroValor>> = Object.freeze({
  SALDO_ANTERIOR: Object.freeze({
    descripcion: 'Saldo pendiente de periodos anteriores',
    codigo_formulario: '24',
    requiere_glosa: false,
  }),
  INTERESES_AUTORIZADOS: Object.freeze({
    descripcion: 'Intereses de mora autorizados por la regulación',
    codigo_formulario: '25',
    requiere_glosa: true,
  }),
  RECONEXION: Object.freeze({
    descripcion: 'Cargo por reconexión del servicio',
    codigo_formulario: '26',
    requiere_glosa: false,
  }),
  FINANCIACION: Object.freeze({
    descripcion: 'Cuota de financiación de deuda previa',
    codigo_formulario: '27',
    requiere_glosa: true,
  }),
  MATERIALES_ACOMETIDA: Object.freeze({
    descripcion: 'Materiales de acometida',
    codigo_formulario: '28',
    requiere_glosa: false,
  }),
  AJUSTES_DEVOLUCIONES: Object.freeze({
    descripcion: 'Ajustes o devoluciones de periodos anteriores',
    codigo_formulario: '29',
    requiere_glosa: true,
  }),
  OTROS_AUTORIZADOS: Object.freeze({
    descripcion: 'Otros conceptos autorizados por la regulación',
    codigo_formulario: '30',
    requiere_glosa: true,
  }),
});

export interface OtroValor {
  readonly concepto: ConceptoOtroValor;
  readonly valor: number;
  readonly glosa?: string;
}

/**
 * Helper puro que valida y crea un OtroValor.
 *
 * Validaciones:
 *  - concepto ∈ OtrosValoresCatalogo
 *  - valor es number finito
 *  - valor ≥ 0
 *  - si el concepto requiere_glosa, glosa es obligatorio (no vacío)
 *
 * Lanza Error con mensaje en espanol descriptivo. Inmutable: retorna
 * objeto deepFrozen.
 */
export function crearOtroValor(
  concepto: ConceptoOtroValor,
  valor: number,
  glosa?: string,
): OtroValor {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new Error('crearOtroValor: valor debe ser un número finito');
  }
  if (valor < 0) {
    throw new Error('crearOtroValor: valor no puede ser negativo');
  }
  const catalogo = OtrosValoresCatalogo[concepto];
  if (catalogo === undefined) {
    throw new Error(`crearOtroValor: concepto '${concepto}' no es válido en el catálogo`);
  }
  if (catalogo.requiere_glosa && (glosa === undefined || glosa.trim() === '')) {
    throw new Error(
      `crearOtroValor: concepto '${concepto}' requiere glosa (${catalogo.descripcion})`,
    );
  }
  const ov: OtroValor = {
    concepto,
    valor,
    ...(glosa !== undefined && glosa.trim() !== '' && { glosa: glosa.trim() }),
  };
  return Object.freeze(ov);
}
