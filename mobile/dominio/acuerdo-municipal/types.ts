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
  // ── Legacy single-factor (backward-compat) ────────────────────────────
  /**
   * Factor de subsidio para estrato 1. Negativo.
   * Rango legal L142/1994 art. 99.6: [-1.0, -0.60].
   * Si el prestador define -0.80, el motor CAPEA a -0.60.
   *
   * @deprecated Mantener por backward-compat. Usar los 3 porcentajes
   *   separados (`factor_subsidio_e1_cf/_basico/_excedente`) en código
   *   nuevo. El motor usa los 3 porcentajes; este campo se conserva
   *   solo para compatibilidad con datos legacy y pantallas antiguas.
   */
  readonly factor_subsidio_e1: number;
  /**
   * Factor de subsidio para estrato 2. Negativo.
   * Rango legal: [-1.0, -0.50].
   * @deprecated Usar `factor_subsidio_e2_cf/_basico/_excedente`.
   */
  readonly factor_subsidio_e2: number;
  /**
   * Factor de subsidio para estrato 3. Negativo.
   * Rango legal: [-1.0, -0.40].
   * @deprecated Usar `factor_subsidio_e3_cf/_basico/_excedente`.
   */
  readonly factor_subsidio_e3: number;

  // ── 3 porcentajes separados (Res CRA 825/2017 + Res CRA 750/2016) ───
  // OPTIONAL por backward-compat: si no estan presentes, el motor usa
  // los legacy factor_subsidio_e{1,2,3} como fallback (factor unico
  // sobre el subtotal). El motor prefiere los 3 porcentajes cuando
  // estan disponibles.
  /**
   * Subsidio E1 sobre Cargo Fijo (CMA/N). Negativo.
   * Rango legal L142/1994 art. 99.6: [-1.0, -0.60].
   * (Res CRA 825/2017: el subsidio se aplica por bloques, no sobre el
   *  subtotal.)
   */
  readonly factor_subsidio_e1_cf?: number;
  /** Subsidio E1 sobre Consumo Basico (primeros 11/13/16 m3 segun altitud). Negativo. */
  readonly factor_subsidio_e1_basico?: number;
  /**
   * Subsidio E1 sobre Consumo Excedente. Por norma SIEMPRE es 0
   * (Res CRA 825/2017 art. 14 — el excedente NO se subsidia).
   */
  readonly factor_subsidio_e1_excedente?: number;

  /** Subsidio E2 sobre CF. Rango: [-1.0, -0.50]. */
  readonly factor_subsidio_e2_cf?: number;
  /** Subsidio E2 sobre Consumo Basico. Rango: [-1.0, -0.50]. */
  readonly factor_subsidio_e2_basico?: number;
  /** Subsidio E2 sobre Excedente. SIEMPRE 0. */
  readonly factor_subsidio_e2_excedente?: number;

  /** Subsidio E3 sobre CF. Rango: [-1.0, -0.40]. */
  readonly factor_subsidio_e3_cf?: number;
  /** Subsidio E3 sobre Consumo Basico. Rango: [-1.0, -0.40]. */
  readonly factor_subsidio_e3_basico?: number;
  /** Subsidio E3 sobre Excedente. SIEMPRE 0. */
  readonly factor_subsidio_e3_excedente?: number;

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
  /**
   * Estado del ciclo de vida del Acuerdo. Transiciones:
   *   BORRADOR — creado por bootstrap, sin acto administrativo cargado.
   *   ACTIVO   — admin cargó `acto_administrativo_url` y aprobó.
   *   VENCIDO  — `fecha_vigencia_hasta < hoy` (transición implícita).
   *   DEROGADO — admin lo derogó explícitamente.
   *
   * El motor tarifario SOLO aplica factores del Acuerdo si está en ACTIVO.
   * Para cualquier otro estado, usa topes L142/1994 art. 99.6 como
   * fallback explícito (ver `motor-tarifario.ts:calcularLiquidacion`).
   *
   * Backward-compat: Acuerdo legacy tiene `estado = 'ACTIVO'` por
   * default (asume acto previo cargado).
   *
   * Fase 2 (`param-tarifa-res-825-compliance-phase2`).
   *
   * OPCIONAL en TS para backward-compat con tests legacy. La persistencia
   * rellena con `'ACTIVO'` para Acuerdo legacy (asume acto previo cargado)
   * y con `'BORRADOR'` para Acuerdo creado por bootstrap nuevo.
   */
  readonly estado?: 'BORRADOR' | 'ACTIVO' | 'VENCIDO' | 'DEROGADO';
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
  eliminar(id: number): Promise<void>;
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
