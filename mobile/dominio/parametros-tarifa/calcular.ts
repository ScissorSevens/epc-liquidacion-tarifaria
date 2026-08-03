/**
 * Calculo de cargos resultantes de ParametrosTarifa.
 *
 * Esta función PURA toma un ParametrosTarifa y devuelve los dos
 * cargos pre-calculados que se PERSISTEN en la misma tabla:
 *   - `cargo_fijo_resultante` (COP / suscriptor / mes)
 *   - `cargo_consumo_resultante` (COP / m³)
 *
 * Por qué pre-calcular y persistir (vs. recalcular en cada factura):
 *   - Decoupling metodologico: si la CRA emite una Res. nueva que
 *     cambia la formula de CF, las facturas EMITIDAS con la
 *     metodología vieja NO se invalidan. Cada factura tiene su
 *     snapshot tarifario.
 *   - Auditoria: el campo persistido es la verdad historica. El
 *     calculo en vivo siempre coincide con lo que se imprimió.
 *   - Performance: liquido una factura con 2 lookups en vez de
 *     recalcular y re-leer todos los componentes.
 *
 * La función es PURA (no muta, no side effects, deterministica).
 * Esto permite que cualquier UI (MiPerfil, modal de edición,
 * preview) muestre los cargos en vivo SIN tener que persistir.
 */

import type { ParametrosTarifa } from './types';

/**
 * Componentes canonicos del modelo tarifario Res CRA 825/2017 +
 * 907/2019. Tipados como union literal para que TS autocomplete
 * en los call sites y para que el array sea exhaustivo.
 */
export type ComponenteTarifa = 'CMA' | 'CMO' | 'CMI' | 'CMT' | 'CMVIAA';

/**
 * Lista canonica de los 5 componentes tarifarios. Se exporta para
 * que la UI pueda iterar (ej: switches de componentes_aplicables en
 * MiPerfil).
 */
export const COMPONENTES_TARIFARIOS: readonly ComponenteTarifa[] = Object.freeze([
  'CMA',
  'CMO',
  'CMI',
  'CMT',
  'CMVIAA',
]);

/** Resultado del calculo de cargos. */
export interface CargosResultantes {
  /** Cargo fijo por suscriptor/mes (COP). */
  readonly cargo_fijo: number;
  /** Cargo por consumo por m³ (COP/m³). */
  readonly cargo_consumo: number;
}

/**
 * Helper interno: clamp a 0 si `n` no es un numero positivo.
 * Usado para proteger división por cero y valores negativos
 * (defensiva — la validación del dominio ya cubre estos casos).
 */
function noNegativo(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Helper: indica si un componente está activo en el array
 * `componentes_aplicables`. Componentes desconocidos en el array
 * (posible forward-compat) se IGNORAN.
 */
function componenteActivo(
  componentes: readonly string[],
  componente: ComponenteTarifa,
): boolean {
  return componentes.includes(componente);
}

/**
 * Calcula los cargos resultantes de un ParametrosTarifa.
 *
 * Reglas (Res CRA 825/2017 art. 9-10 + 907/2019 art. 14):
 *   - CF = CMA / N (si CMA está en `componentes_aplicables`).
 *   - CC_unitario = CMO + CMI + CMT + CMVIAA
 *     (CMVIAA solo si aplica_cmviaa=true y CMVIAA en
 *     `componentes_aplicables`).
 *
 * Defensiva:
 *   - N <= 0 → cargo_fijo = 0 (anti division por cero).
 *   - Componentes desconocidos en el array → ignorados.
 *   - Input con campos no-finitos → 0 (no NaN, no Infinity).
 *
 * @param p ParametrosTarifa con todos los campos completos.
 * @returns { cargo_fijo, cargo_consumo } (number, no string).
 */
export function calcularCargos(p: ParametrosTarifa): CargosResultantes {
  const cma = noNegativo(p.cma);
  const cmo = noNegativo(p.cmo);
  const cmi = noNegativo(p.cmi);
  const cmt = noNegativo(p.cmt);
  const cmviaa = noNegativo(p.cmviaa);
  const n = p.suscriptores_promedio;

  const cargo_fijo =
    componenteActivo(p.componentes_aplicables, 'CMA') && n > 0
      ? cma / n
      : 0;

  let cargo_consumo = 0;
  if (componenteActivo(p.componentes_aplicables, 'CMO')) cargo_consumo += cmo;
  if (componenteActivo(p.componentes_aplicables, 'CMI')) cargo_consumo += cmi;
  if (componenteActivo(p.componentes_aplicables, 'CMT')) cargo_consumo += cmt;
  if (p.aplica_cmviaa && componenteActivo(p.componentes_aplicables, 'CMVIAA')) {
    cargo_consumo += cmviaa;
  }

  return { cargo_fijo, cargo_consumo };
}
