/**
 * Tipos del módulo ACUERDO MUNICIPAL — modelo tipado (Q6 spec).
 *
 * El Acuerdo Municipal define los topes de subsidio/contribución que
 * aplican al prestador. El motor CAPEA al tope nacional L142/1994 art.
 * 99.6 al momento del cálculo (ver motor-tarifario.ts: caparFactorEstrato).
 *
 * Histórico: 1 prestador puede tener N Acuerdos (uno por periodo), pero
 * solo 1 vigente en cualquier momento. Los Acuerdos históricos son
 * read-only en la UI admin.
 */

export interface AcuerdoMunicipal {
  readonly id_acuerdo: number;
  readonly id_prestador: number;
  /**
   * Factor de subsidio para estrato 1. Negativo.
   * Rango legal L142/1994 art. 99.6: [-1.0, -0.60].
   * Si el prestador define -0.80, el motor CAPEA a -0.60.
   */
  readonly factor_subsidio_e1: number;
  /**
   * Factor de subsidio para estrato 2. Negativo.
   * Rango legal: [-1.0, -0.50].
   */
  readonly factor_subsidio_e2: number;
  /**
   * Factor de subsidio para estrato 3. Negativo.
   * Rango legal: [-1.0, -0.40].
   */
  readonly factor_subsidio_e3: number;
  /**
   * Factor de contribución para estrato 5. Positivo.
   * Rango legal: [0, +0.50].
   */
  readonly factor_contribucion_e5: number;
  /**
   * Factor de contribución para estrato 6. Positivo.
   * Rango legal: [0, +0.60].
   */
  readonly factor_contribucion_e6: number;
  /**
   * Factor de contribución para categoría comercial.
   * Default +0.50 (L142/1994 art. 99.6). SIEMPRE >= 0.
   */
  readonly factor_contribucion_comercial: number;
  /**
   * Factor de contribución para categoría industrial.
   * Default +0.30 (L142/1994 art. 99.6). SIEMPRE >= 0.
   */
  readonly factor_contribucion_industrial: number;
  /** ISO 8601 (YYYY-MM-DD). */
  readonly fecha_vigencia_desde: string;
  /** ISO 8601 (YYYY-MM-DD). */
  readonly fecha_vigencia_hasta: string;
  readonly acto_administrativo_url: string | null;
  readonly observaciones: string | null;
  readonly created_at: string;
}

export type AcuerdoMunicipalBorrador = Omit<AcuerdoMunicipal, 'id_acuerdo' | 'created_at'>;

export type CrearAcuerdoMunicipalInput = AcuerdoMunicipalBorrador;

export interface FiltrosListarAcuerdos {
  readonly id_prestador: number;
  /** Si se especifica, retorna solo el Acuerdo vigente en esa fecha. */
  readonly vigenteEn?: string;
}

/**
 * Puerto del repositorio. `buscarVigente` es el método principal que
 * usa el motor y la UI: dado un id_prestador y una fecha, retorna el
 * Acuerdo activo en ese momento (o null si no hay).
 */
export interface AcuerdoMunicipalRepository {
  crear(data: CrearAcuerdoMunicipalInput): Promise<AcuerdoMunicipal>;
  obtenerPorId(id_acuerdo: number): Promise<AcuerdoMunicipal | null>;
  listar(filtros: FiltrosListarAcuerdos): Promise<readonly AcuerdoMunicipal[]>;
  /**
   * Retorna el Acuerdo vigente del prestador en la fecha dada.
   * `null` si no hay Acuerdo vigente.
   */
  buscarVigente(id_prestador: number, fecha: string): Promise<AcuerdoMunicipal | null>;
}

export const MENSAJES_ERROR_ACUERDO = {
  PRESTADOR_REQUERIDO: 'id_prestador requerido',
  FECHA_DESDE_REQUERIDA: 'fecha_vigencia_desde requerida',
  FECHA_HASTA_REQUERIDA: 'fecha_vigencia_hasta requerida',
  FECHA_HASTA_MENOR: 'fecha_vigencia_hasta debe ser >= fecha_vigencia_desde',
  FACTOR_E1_FUERA_RANGO: 'factor_subsidio_e1 fuera de rango legal (-1.0 a -0.60)',
  FACTOR_E2_FUERA_RANGO: 'factor_subsidio_e2 fuera de rango legal (-1.0 a -0.50)',
  FACTOR_E3_FUERA_RANGO: 'factor_subsidio_e3 fuera de rango legal (-1.0 a -0.40)',
  FACTOR_E5_FUERA_RANGO: 'factor_contribucion_e5 fuera de rango legal (0 a +0.50)',
  FACTOR_E6_FUERA_RANGO: 'factor_contribucion_e6 fuera de rango legal (0 a +0.60)',
  FACTOR_COMERCIAL_NEGATIVO: 'factor_contribucion_comercial no puede ser negativo',
  FACTOR_INDUSTRIAL_NEGATIVO: 'factor_contribucion_industrial no puede ser negativo',
  SOLAPAMIENTO_VIGENCIA: 'ya existe Acuerdo vigente en ese rango de fechas',
} as const;
