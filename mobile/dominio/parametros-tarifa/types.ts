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
 *
 * Extensiones del modelo (Res CRA 825/2017 compliance completo):
 *   - `ipuf_indice`: Índice de Precios al Usuario Final. Default 1.0
 *     (= sin ajuste). Multiplicador periódico para actualizar precios
 *     sin re-emitir toda la metodología tarifaria.
 *   - `cargo_fijo_resultante` + `cargo_consumo_resultante`: valores
 *     pre-calculados (ver `/calcular.ts`) y PERSISTIDOS al guardar.
 *     NO se recalculan en cada factura: si la metodología cambia, las
 *     facturas históricas NO se invalidan (decoupling critico).
 *   - `componentes_aplicables`: subset de componentes que están
 *     ACTIVOS para este prestador. Default = todos. Permite que
 *     segmento 2 rural NO aplique CMVIAA o CMT (caso real).
 *   - `minimo_vital`: tabla relacionada 1:1 con prestador. Tiene su
 *     PROPIA vigencia (independiente del periodo tarifario). null =
 *     prestador sin mínimo vital configurado.
 */

import type { MinimoVital } from './minimo-vital';

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
   * ASP = AS - IPUF*12*N y validaciones regulatorias (CMOG mínimo,
   * consumo básico por altitud). NO participa en el cálculo del CF:
   * desde `param-tarifa-res-825-compliance-phase2` (GAP-1), CF = cma + cmaa
   * directamente (cma es $/suscriptor/mes normativo, no CA anual).
   */
  readonly suscriptores_promedio: number;
  /**
   * Flag: mínimo vital activo para este prestador. Default false
   * (825/2017 no obliga, ver Q9 spec).
   *
   * NOTA: este flag se conserva por backward-compat con data legacy.
   * La fuente de verdad del mínimo vital es la tabla relacionada
   * `minimo_vital` (ver `minimo_vital: MinimoVital | null`). Si
   * `minimo_vital !== null`, hay mínimo vital configurado.
   */
  readonly aplica_minimo_vital: boolean;
  /** m³ gratis por mínimo vital. Default 0 (desactiva aunque flag=true). */
  readonly m3_gratis_minimo_vital: number;
  /**
   * Índice de Precios al Usuario Final. Multiplicador periódico para
   * actualizar precios sin re-emitir la metodología tarifaria. Default
   * 1.0 (sin ajuste). Numero decimal: 1.05 = 5% de incremento.
   *
   * NO se usa en el calculo del cargo_resultante (esa es la fórmula
   * normativa cruda); se aplica DESPUES, al momento de emitir la
   * factura, sobre el cargo persistido.
   */
  readonly ipuf_indice: number;
  /**
   * Cargo fijo resultado (COP / suscriptor / mes). PRE-CALCULADO al
   * guardar (= CMA / N si CMA está en `componentes_aplicables`) y
   * PERSISTIDO. NO se recalcula en cada factura.
   *
   * Si bien el motor tarifario podría recalcularlo, persistirlo
   * desacopla las facturas del cambio de metodología (key insight del
   * user: "future methodology changes don't break historic facturas").
   */
  readonly cargo_fijo_resultante: number;
  /**
   * Cargo por consumo resultado (COP / m³). PRE-CALCULADO al guardar
   * (= CMO + CMI + CMT + CMVIAA si los componentes están activos) y
   * PERSISTIDO. NO se recalcula en cada factura.
   */
  readonly cargo_consumo_resultante: number;
  /**
   * Componentes del modelo tarifario que están ACTIVOS para este
   * prestador. Subset de `COMPONENTES_TARIFARIOS`. Default = todos.
   * Si un componente NO está, su valor NO contribuye al cargo
   * resultante (ej: segmento 2 rural sin CMVIAA).
   */
  readonly componentes_aplicables: readonly string[];
  /**
   * Mínimo vital del prestador. Tabla relacionada 1:1 con prestador
   * (un prestador tiene UN mínimo vital vigente a la vez). null =
   * prestador sin mínimo vital configurado.
   *
   * Su propia vigencia (vigente_desde → vigente_hasta) es
   * INDEPENDIENTE del periodo tarifario de los ParametrosTarifa.
   */
  readonly minimo_vital: MinimoVital | null;
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
  readonly created_at: string;
  /**
   * Año base para el cálculo del factor IPC (Res CRA 825/2017 Art. 7).
   * Default 2016. Solo operativo si `factor_indexacion_ipc` se calcula
   * automáticamente; un override manual del admin lo sustituye.
   *
   * Fase 1 (`param-tarifa-res-825-compliance-phase1`).
   */
  readonly anio_base: number;
  /**
   * Factor de indexación IPC persistido (Res CRA 825/2017 Art. 11).
   * Default 1.0 (sin indexación). El admin puede override manual;
   * si no, se calcula como `IPC_VALORES[anio_destino] / IPC_VALORES[anio_base]`.
   *
   * Metadato. NO es insumo del motor tarifario (no se usa en
   * `emitirFactura` ni `liquidacion`).
   *
   * Fase 1 (`param-tarifa-res-825-compliance-phase1`).
   */
  readonly factor_indexacion_ipc: number;
  /**
   * Año destino para el cálculo del factor IPC (Res CRA 825/2017
   * Art. 11). El factor se calcula como
   * `IPC_VALORES[anio_destino] / IPC_VALORES[anio_base]`.
   *
   * OPTIONAL por backward-compat con data legacy. `null` = sin
   * indexación configurada (factor permanece en 1.0).
   *
   * Phase 1 (`param-tarifa-residuales-cra-825` task 1.6).
   */
  readonly anio_destino_indexacion?: number | null;
  /**
   * Altitud del prestador sobre el nivel del mar (msnm). Determina
   * el límite de consumo básico conforme a Res CRA 750/2016:
   *   altitud > 2.000 → 11 m³/mes
   *   altitud 1.000-2.000 → 13 m³/mes
   *   altitud ≤ 1.000 → 16 m³/mes
   *
   * OPTIONAL por backward-compat con data legacy. `null` = altitud
   * desconocida; el motor usa el limite default de 16 m³/mes (≤1.000
   * msnm) como fallback conservador.
   *
   * Fase 4 (`compliance-cra-825-subsidios-bloques`).
   */
  readonly altitud_msnm?: number | null;
  /**
   * CMAA — Costo Medio de Administración por Inversiones Ambientales
   * Adicionales (Res CRA 907/2019 art. 13 que modifica Res CRA 825/2017
   * art. 9). SOLO aplica al servicio de ACUEDUCTO. Para alcantarillado
   * el CF es solo CMA (sin CMAA). El prestador puede optar por incluir
   * estas inversiones — si lo hace, setea `cmaa > 0` y `aplica_cmviaa = true`.
   *
   * Normativa: Res CRA 0874/2018 + Res CRA 907/2019 art. 31.B.
   *
   * `null` por backward-compat con data legacy. Default 0 si el prestador
   * NO opta por inversiones ambientales.
   *
   * Fase 2 (`param-tarifa-res-825-compliance-phase2`).
   */
  readonly cmaa?: number | null;
  /**
   * URL o referencia del acto administrativo que adoptó la metodología
   * tarifaria del prestador. Requerido para que la `AcuerdoMunicipal`
   * pase a `estado: ACTIVO`. Ej: decreto alcaldía 042 de 2024.
   *
   * OPTIONAL por backward-compat. Default null.
   */
  readonly acto_adopcion?: string | null;
  /** ID del estudio de costos del prestador (referencia externa, ej: SUI). */
  readonly estudio_costos_id?: string | null;
  /** URL del documento soporte del estudio de costos (PDF, etc.). */
  readonly documento_soporte_url?: string | null;
  /**
   * Flag explicito: el prestador OPTA por inversiones ambientales
   * adicionales (Res CRA 907/2019 art. 13, mod. Res CRA 825/2017 art. 9).
   * Si `true`, el CMAA se computa en el cargo fijo resultante. Si `false`
   * (default), el CMAA NO se computa aunque `cmaa > 0`.
   *
   * Decision B/B/B: el flag es la fuente de verdad del opt-in. Antes
   * de Phase 2 se inferia de `cmaa > 0`, lo que permitia que un admin
   * que setea `cmaa = 0` por error apague el CMAA sin warning. Con el
   * flag explicito, el comportamiento es opt-in consciente.
   *
   * OPTIONAL por backward-compat con data legacy (Phase 2 task 2.2 GREEN).
   * `undefined` se trata como `false` (no aplica CMAA).
   *
   * Phase 2 (`param-tarifa-residuales-cra-825` task 2.2).
   */
  readonly aplica_cmaa?: boolean;
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
  /**
   * UPSERT por (id_prestador, periodo, vigente_desde). Si ya existe una
   * fila con esa triple clave, actualiza todos los campos; si no, inserta
   * nueva. Retorna el ParametrosTarifa persistido (con id_parametros +
   * created_at). El id_parametros NO cambia en un UPSERT match — es la
   * misma fila actualizada.
   *
   * El screen admin `ParametrosTarifa.tsx` usa esto para "Guardar
   * Parámetros": carga `buscarVigente` para pre-rellenar y luego
   * `guardar` para persistir (sea alta nueva o edición).
   */
  guardar(data: ParametrosTarifaBorrador): Promise<ParametrosTarifa>;
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
  IPUF_INDICE_NEGATIVO: 'ipuf_indice no puede ser negativo',
  FECHA_DESDE_REQUERIDA: 'vigente_desde requerida',
  FECHA_HASTA_REQUERIDA: 'vigente_hasta requerida',
  DUPLICADO_MISMO_PERIODO: 'ya existen Parametros vigentes para ese prestador/periodo',
  // Res CRA 825/2017 Art. 15: el CMA no puede ser menor al mínimo
  // normativo del servicio. Cambio `param-tarifa-res-825-compliance-phase1`.
  CMA_BAJO_MINIMO: 'CMA no puede ser menor al mínimo normativo de la Res CRA 825 Art. 15',
  // Res CRA 825/2017 Art. 18: el CMOG no puede ser menor al mínimo
  // normativo del servicio. Cambio `param-tarifa-res-825-compliance-phase2`.
  CMOG_BAJO_MINIMO: 'CMOG no puede ser menor al mínimo normativo de la Res CRA 825 Art. 18',
} as const;
