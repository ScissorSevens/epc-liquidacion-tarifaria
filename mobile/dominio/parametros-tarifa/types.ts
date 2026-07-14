/**
 * Tipos del módulo PARAMETROS TARIFA — insumos del motor tarifario
 * según Res CRA 825/2017 (art. 9-10) mod. por Res 907/2019 (art. 14).
 *
 * ParametrosTarifa NO es un input plano del motor: provee los COSTOS
 * MEDIOS (CMA, CMO, CMI, CMT, CMVIAA) + datos de agua (AS, IPUF, N)
 * que el motor usa para calcular CF = CMA/N y CC_unitario = (CMO+CMI
 * +CMT)/ASP + CMVIAA. Ver motor-tarifario.ts.
 *
 * Multi-tenant: 1 prestador tiene N Parametros (uno por periodo), pero
 * solo 1 vigente en cualquier momento. El periodo tarifario es 5 años
 * según Res 825/2017.
 */

export interface ParametrosTarifa {
  readonly id_parametros: number;
  readonly id_prestador: number;
  readonly id_acuerdo: number;
  /** Año tarifario (Res 825/2017: periodo = 5 años). */
  readonly periodo: number;
  /** Costo Medio de Administración anual (art. 9 Res 825/2017). */
  readonly cma: number;
  /** Costo Medio de Operación por m³. */
  readonly cmo: number;
  /** Costo Medio de Inversión por m³. */
  readonly cmi: number;
  /** Costo Medio de Tasas Ambientales por m³. */
  readonly cmt: number;
  /**
   * Costo Medio Variable de Inversiones Ambientales Adicionales por m³
   * (art. 14 Res 907/2019 mod. art. 10 Res 825/2017). Default 0.
   * Si `aplica_cmviaa=false`, el motor ignora este campo.
   */
  readonly cmviaa: number;
  /**
   * Flag: el prestador OPTA por inversiones ambientales (Res 0874/2018
   * art. 3: compra predios, recarga acuíferos, restauración, etc.).
   * Default false.
   */
  readonly aplica_cmviaa: boolean;
  /** Agua potable total suministrada año base (m³/año). Insumo para ASP. */
  readonly agua_suministrada_m3_anio: number;
  /**
   * Índice de Pérdidas por Usuario Facturado estándar (m³/suscriptor/mes).
   * Default 6 según art. 5 Res 825/2017 (constante normativa).
   */
  readonly ipuf_m3_suscriptor_mes: number;
  /**
   * Suscriptores promedio mensual facturados año base (N). Insumo para
   * CF = CMA/N y ASP = AS - IPUF*12*N.
   */
  readonly suscriptores_promedio: number;
  /**
   * Flag: mínimo vital activo para este prestador. Default false
   * (825/2017 no obliga, ver Q9 spec).
   */
  readonly aplica_minimo_vital: boolean;
  /** m³ gratis por mínimo vital. Default 0 (desactiva aunque flag=true). */
  readonly m3_gratis_minimo_vital: number;
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
  readonly created_at: string;
}

export type ParametrosTarifaBorrador = Omit<ParametrosTarifa, 'id_parametros' | 'created_at'>;

export type CrearParametrosTarifaInput = ParametrosTarifaBorrador;

export interface FiltrosListarParametros {
  readonly id_prestador: number;
  readonly periodo?: number;
  readonly vigenteEn?: string;
}

/**
 * Puerto del repositorio. `buscarVigente` es el método principal que
 * usa el bootstrap y la UI.
 */
export interface ParametrosTarifaRepository {
  crear(data: CrearParametrosTarifaInput): Promise<ParametrosTarifa>;
  obtenerPorId(id_parametros: number): Promise<ParametrosTarifa | null>;
  listar(filtros: FiltrosListarParametros): Promise<readonly ParametrosTarifa[]>;
  /**
   * Retorna los Parametros vigentes del prestador en la fecha dada.
   * `null` si no hay Parametros vigentes.
   */
  buscarVigente(id_prestador: number, fecha: string): Promise<ParametrosTarifa | null>;
  buscarPorPeriodo(id_prestador: number, periodo: number): Promise<ParametrosTarifa | null>;
  eliminar(id: number): Promise<void>;
}

export const MENSAJES_ERROR_PARAMETROS = {
  PRESTADOR_REQUERIDO: 'id_prestador requerido',
  ACUERDO_REQUERIDO: 'id_acuerdo requerido',
  PERIODO_INVALIDO: 'periodo debe ser un año válido (>= 2000)',
  CMA_NEGATIVO: 'cma no puede ser negativo',
  CMO_NEGATIVO: 'cmo no puede ser negativo',
  CMI_NEGATIVO: 'cmi no puede ser negativo',
  CMT_NEGATIVO: 'cmt no puede ser negativo',
  CMVIAA_NEGATIVO: 'cmviaa no puede ser negativo',
  AGUA_NEGATIVA: 'agua_suministrada_m3_anio no puede ser negativo',
  IPUF_NEGATIVO: 'ipuf_m3_suscriptor_mes no puede ser negativo',
  SUSCRIPTORES_REQUERIDO: 'suscriptores_promedio debe ser > 0',
  M3_GRATIS_NEGATIVO: 'm3_gratis_minimo_vital no puede ser negativo',
  FECHA_DESDE_REQUERIDA: 'vigente_desde requerida',
  FECHA_HASTA_REQUERIDA: 'vigente_hasta requerida',
  DUPLICADO_MISMO_PERIODO: 'ya existen Parametros vigentes para ese prestador/periodo',
} as const;
