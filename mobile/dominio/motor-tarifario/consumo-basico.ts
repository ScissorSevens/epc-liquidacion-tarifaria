/**
 * Helper `aplicarConsumoBasico` — Res CRA 750/2016 compliance.
 *
 * Divide el consumo del usuario en dos bloques:
 *   - `basico`: los primeros N m³ del periodo (subsidiables).
 *   - `excedente`: el resto (NO subsidiables, Res CRA 825/2017 art. 14).
 *
 * El límite N depende de la altitud del prestador sobre el nivel del
 * mar (Art. 3 Res CRA 750/2016):
 *   altitud > 2.000 msnm  → 11 m³/mes
 *   altitud 1.000-2.000 msnm → 13 m³/mes
 *   altitud ≤ 1.000 msnm  → 16 m³/mes
 *
 * El límite mensual se multiplica por `periodo_meses` para soportar
 * facturación multi-mes (bimestral, semestral, etc.).
 *
 * Si `altitud_msnm` es null/undefined, se usa el límite más conservador
 * (16 m³/mes) como fallback. Esto preserva backward-compat con data
 * legacy donde la altitud no estaba configurada.
 *
 * Pure function: no side effects, determinista.
 */

import type { ParametrosTarifa } from '../parametros-tarifa';

/**
 * Límites de consumo básico en m³/mes según altitud (Art. 3 Res CRA 750/2016).
 * Exportado para que la UI pueda mostrar el límite calculado al operario
 * (preview en ParametrosTarifa.tsx al tipear la altitud).
 */
export const LIMITES_CONSUMO_BASICO_MS3 = {
  mas2000: 11,
  mil2000: 13,
  mil1000: 16,
} as const;

/**
 * Resultado de la división consumo básico vs excedente.
 *  - `basico`: m³ subsidiables (primeros N del periodo).
 *  - `excedente`: m³ no subsidiables (resto).
 * Ambos son enteros (m³ no se pueden facturar en fracciones — la
 * normativa tarifaria trabaja en m³ enteros).
 */
export interface DivisionConsumo {
  readonly basico: number;
  readonly excedente: number;
}

/**
 * Calcula el límite de consumo básico para un prestador en función
 * de su altitud. Pure helper, reutilizable por la UI y el motor.
 */
export function limiteConsumoBasicoMensual(altitud_msnm: number | null | undefined): number {
  if (altitud_msnm == null) return LIMITES_CONSUMO_BASICO_MS3.mil1000; // 16, fallback conservador
  if (altitud_msnm > 2_000) return LIMITES_CONSUMO_BASICO_MS3.mas2000; // 11
  if (altitud_msnm > 1_000) return LIMITES_CONSUMO_BASICO_MS3.mil2000; // 13
  return LIMITES_CONSUMO_BASICO_MS3.mil1000; // 16
}

/**
 * Divide el consumo total del usuario en básico + excedente conforme
 * a Res CRA 750/2016.
 *
 * @param consumo        m³ consumidos en el periodo (>= 0).
 * @param altitud_msnm   altitud del prestador (msnm). null = 16 m³/mes.
 * @param periodo_meses  meses del periodo de facturación (default 1).
 *                       Multi-mes: bimestral = 2, semestral = 6, etc.
 * @returns              { basico, excedente } en m³ enteros.
 *
 * @throws Si `consumo` es negativo o `periodo_meses` <= 0.
 */
export function aplicarConsumoBasico(
  consumo: number,
  altitud_msnm: number | null | undefined,
  periodo_meses: number = 1,
): DivisionConsumo {
  if (consumo < 0) {
    throw new Error('consumo no puede ser negativo');
  }
  if (periodo_meses <= 0) {
    throw new Error('periodo_meses debe ser > 0');
  }
  const limiteMensual = limiteConsumoBasicoMensual(altitud_msnm);
  const limitePeriodo = limiteMensual * periodo_meses;
  const basico = Math.min(consumo, limitePeriodo);
  const excedente = Math.max(0, consumo - limitePeriodo);
  return { basico, excedente };
}

/**
 * Helper de conveniencia para derivar el límite directamente desde
 * ParametrosTarifa (lee `altitud_msnm` y `periodo`).
 */
export function limiteConsumoBasicoDesdeParametros(
  parametros: ParametrosTarifa,
): number {
  return limiteConsumoBasicoMensual(parametros.altitud_msnm ?? null);
}