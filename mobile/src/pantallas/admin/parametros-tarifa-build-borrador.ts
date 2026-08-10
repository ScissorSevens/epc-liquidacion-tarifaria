// mobile/src/pantallas/admin/parametros-tarifa-build-borrador.ts
//
// Helper `buildBorradorLocal` — extraido del `guardar()` de
// ParametrosTarifa.tsx para ser reusado por:
//
//   1. `guardar()` al persistir (parametros_tarifa.guardar)
//   2. `useMemo` del card ResumenCargos (live preview)
//
// D2 (parametros-tarifa-impeccable-v2) hallazgo critico:
//
//   `calcularCargos(p)` EXIGE el shape COMPLETO de ParametrosTarifa.
//   Pasar un partial genera campos undefined que el motor no
//   defensivamente cubre — `componentes_aplicables.includes(...)`
//   tira TypeError porque `.includes()` sobre undefined es runtime error.
//   Por eso este helper centraliza la construccion del shape completo.
//
// El helper tambien aplica las reglas de negocio que antes vivian inline:
//
//   - `aplica_cmviaa=false` → CMVIAA se quita de `componentes_aplicables`
//     y su valor se fuerza a 0 (calcularCargos lo trata igual, pero
//     persistir el valor explicito evita sorpresas en auditoria).
//   - `aplica_minimo_vital=false` → `m3_gratis_minimo_vital=0` por
//     consistencia.
//   - Strings del form se parsean a number. Strings vacios / NaN → 0.

import type { ParametrosTarifaBorrador } from '../../../dominio/parametros-tarifa/types';
import { COMPONENTES_TARIFARIOS } from '../../../dominio/parametros-tarifa/calcular';

/**
 * Shape del state local del screen ParametrosTarifa.
 * Refleja los 15 useState del componente (periodo, anioBase, cma, ...).
 *
 * Fase 2 (`param-tarifa-res-825-compliance-phase2`, task 4.5+4.7):
 * incluye 4 campos adicionales de soporte documental / CMAA:
 *   - cmaa: Costo Medio de Administración por Inversiones Ambientales
 *     Adicionales (Res CRA 907/2019 art. 13 mod. Res CRA 825/2017 art. 9).
 *   - actoAdopcion: URL del acto administrativo de adopción.
 *   - estudioCostosId: ID del estudio de costos (referencia externa).
 *   - documentoSoporteUrl: URL del documento soporte del estudio.
 */
export interface FormValues {
  readonly periodo: string;
  readonly anioBase: string;
  readonly cma: string;
  readonly cmo: string;
  readonly cmi: string;
  readonly cmt: string;
  readonly cmviaa: string;
  readonly cmaa: string;
  readonly aplicaCmviaa: boolean;
  readonly actoAdopcion: string;
  readonly estudioCostosId: string;
  readonly documentoSoporteUrl: string;
  readonly aguaSuministrada: string;
  readonly ipuf: string;
  readonly suscriptoresPromedio: string;
  readonly aplicaMinimoVital: boolean;
  readonly m3Gratis: string;
  readonly vigenteDesde: string;
  readonly vigenteHasta: string;
  readonly altitud: string;
}

/** Contexto: id_prestador + id_acuerdo que derivan `ParametrosTarifa`. */
export interface BorradorCtx {
  readonly id_prestador: number;
  readonly id_acuerdo: number;
  /**
   * `vigente_desde` original leído del repo (full ISO con tiempo, ej:
   * `'2026-08-10T18:30:00.000Z'`). Si el `form.vigenteDesde` coincide
   * con `vigenteDesdePersistido.slice(0, 10)`, el usuario NO editó la
   * fecha y el helper preserva el formato original. Esto evita que el
   * UPSERT del repo (triple clave `id_prestador, periodo, vigente_desde`)
   * genere fila duplicada cuando el bootstrap guardó con full ISO y el
   * screen convierte a date-only. Ver `parametros-tarifa-upsert-stale.e2e.test.ts`.
   *
   * Opcional: si NO se provee, se usa `form.vigenteDesde` tal cual.
   */
  readonly vigenteDesdePersistido?: string | null;
}

/** Parsea un string a number; NaN/empty → 0. */
function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Parsea un string a integer; NaN/empty → 0. */
function entero(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Helper de string → number|null. Convierte '' a null (para los docs
 * opcionales que la columna SQLite admite como NULL). Strings NaN
 * tambien caen a null.
 */
function stringOVacioANull(s: string): string | null {
  if (s === undefined || s === null) return null;
  const trimmed = s.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Construye un ParametrosTarifaBorrador (sin id_parametros/created_at)
 * desde los FormValues del state local. El shape es COMPLETO — el caller
 * puede pasar el resultado directo a `calcularCargos()`.
 *
 * @param form FormValues del state local (14 strings + 2 booleans +
 *             4 nuevos campos Fase 2: cmaa, actoAdopcion,
 *             estudioCostosId, documentoSoporteUrl).
 * @param ctx  id_prestador + id_acuerdo del workspace / bootstrap.
 * @returns ParametrosTarifaBorrador listo para `calcularCargos` o `repo.guardar`.
 */
export function buildBorradorLocal(
  form: FormValues,
  ctx: BorradorCtx,
): ParametrosTarifaBorrador {
  const componentesSinCmviaa = COMPONENTES_TARIFARIOS.filter((c) => c !== 'CMVIAA');

  // Fix bug stale-state (T-PARAM-STALE-PERSIST):
  //
  // El bootstrap (`bootstrap-completo.ts:201`) crea la fila inicial
  // con `vigente_desde = ahora.toISOString()` → full ISO con tiempo
  // (ej: `'2026-08-10T18:30:00.000Z'`). La pantalla, al hidratar el
  // form, hace `.slice(0, 10)` → date-only (`'2026-08-10'`).
  //
  // El UPSERT del repo usa la triple clave
  // `(id_prestador, periodo, vigente_desde)`. Si guardamos con
  // date-only pero la DB tiene full ISO, el UPSERT NO MATCHEA →
  // INSERT nueva fila → 2 filas en DB → `buscarVigente ORDER BY
  // vigente_desde DESC LIMIT 1` devuelve la vieja del bootstrap →
  // form muestra el valor viejo, no el recién guardado.
  //
  // Solución: si el `ctx.vigenteDesdePersistido` está disponible
  // (es decir, leímos una fila del repo antes) Y el `form.vigenteDesde`
  // coincide con `vigenteDesdePersistido.slice(0, 10)` (el usuario
  // NO editó la fecha), preservar el formato original.
  //
  // Si el usuario SÍ editó la fecha (caso raro, sería crear un nuevo
  // periodo), usamos el valor del form tal cual. El form muestra
  // date-only; el repo interpreta eso como una fecha distinta
  // (no match con la fila existente) → INSERT nuevo. Eso es el
  // comportamiento esperado al cambiar de periodo tarifario.
  let vigente_desde: string = form.vigenteDesde;
  if (
    ctx.vigenteDesdePersistido !== undefined &&
    ctx.vigenteDesdePersistido !== null &&
    form.vigenteDesde === ctx.vigenteDesdePersistido.slice(0, 10)
  ) {
    vigente_desde = ctx.vigenteDesdePersistido;
  }

  return {
    id_prestador: ctx.id_prestador,
    id_acuerdo: ctx.id_acuerdo,
    periodo: entero(form.periodo),
    anio_base: entero(form.anioBase),
    cma: num(form.cma),
    cmo: num(form.cmo),
    cmi: num(form.cmi),
    cmt: num(form.cmt),
    cmviaa: form.aplicaCmviaa ? num(form.cmviaa) : 0,
    // CMAA (Fase 2, task 4.7 GREEN): Costo Medio de Administración
    // por Inversiones Ambientales Adicionales. Se persiste como
    // number (0 = sin inversiones). Si el campo del form está vacío,
    // caemos a 0 (no null) para que el motor siempre vea un number.
    cmaa: num(form.cmaa),
    aplica_cmviaa: form.aplicaCmviaa,
    // 3 docs de soporte (Fase 2, task 4.7 GREEN). '' → null para
    // mantener la convención de la columna SQLite (TEXT NULL por
    // backward-compat con acuerdos legacy sin docs).
    acto_adopcion: stringOVacioANull(form.actoAdopcion),
    estudio_costos_id: stringOVacioANull(form.estudioCostosId),
    documento_soporte_url: stringOVacioANull(form.documentoSoporteUrl),
    agua_suministrada_m3_anio: num(form.aguaSuministrada),
    ipuf_m3_suscriptor_mes: num(form.ipuf),
    suscriptores_promedio: entero(form.suscriptoresPromedio),
    aplica_minimo_vital: form.aplicaMinimoVital,
    m3_gratis_minimo_vital: form.aplicaMinimoVital ? entero(form.m3Gratis) : 0,
    // ipuf_indice: 1.0 = sin ajuste (Res CRA 825 Art. 7 — fase 1
    // compliance). En produccion se calcula via calcularFactorIpc().
    ipuf_indice: 1.0,
    factor_indexacion_ipc: 1.0,
    componentes_aplicables: form.aplicaCmviaa
      ? [...COMPONENTES_TARIFARIOS]
      : componentesSinCmviaa,
    minimo_vital: null,
    vigente_desde,
    vigente_hasta: form.vigenteHasta,
    // altitud_msnm: Res CRA 750/2016 compliance. 0 = default a nivel
    // del mar → limite 16 m3/mes (el mas conservador).
    altitud_msnm: entero(form.altitud),
    // cargo_fijo_resultante + cargo_consumo_resultante se recalculan via
    // calcularCargos() en guardar() / useMemo. Acá los dejamos en 0
    // como placeholders (la factoría pura los ignora).
    cargo_fijo_resultante: 0,
    cargo_consumo_resultante: 0,
  };
}