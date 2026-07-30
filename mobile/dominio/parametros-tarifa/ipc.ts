/**
 * Tabla IPC Colombia — factor de indexación Res CRA 825/2017 Art. 11.
 *
 * Tabla inmutable (Object.freeze) de valores IPC representativos
 * del DANE, base 2016 = 1.0. Usada para calcular el factor de
 * indexación entre `anio_base` y el año destino.
 *
 * NOTA IMPORTANTE — Fase 1:
 *   Los valores son APROXIMACIONES representativas de la serie
 *   oficial DANE, NO el dato canónico. Sirven para que la app tenga
 *   un valor por defecto razonable. En fase 2 (cambio futuro) la
 *   tabla será reemplazada por una serie versionada, mantenida
 *   entra migrations y admin-overridable.
 *
 * Decisiones:
 *   - `as const` en el objeto + `Object.freeze` en runtime: la tabla
 *     NO puede mutarse en runtime. Tests verifican inmutabilidad.
 *   - El admin puede override manual del factor calculado via
 *     `ParametrosTarifa.factor_indexacion_ipc`. Esta tabla SOLO
 *     provee el default.
 *   - El factor IPC NO es insumo del motor tarifario — es solo
 *     metadato para admin. `emitirFactura` y `liquidacion` no lo
 *     usan.
 */

export const IPC_VALORES: Readonly<Record<number, number>> = Object.freeze({
  2016: 1.0,
  2017: 1.0534,
  2018: 1.0992,
  2019: 1.1462,
  2020: 1.1762,
  2021: 1.2325,
  2022: 1.3285,
  2023: 1.4289,
  2024: 1.5098,
  2025: 1.5782,
  2026: 1.6234,
});

/**
 * Calcula el factor de indexación IPC entre dos años.
 *
 * Fórmula: `IPC_VALORES[anio_destino] / IPC_VALORES[anio_base]`.
 *
 * Fallback: si `anio_base` o `anio_destino` no están en la tabla
 * (año futuro o inválido), retorna 1.0 (no-op). Esto evita que
 * un año mal tipeado del operador rompa el cálculo con NaN.
 *
 * Pura: no side effects, deterministica.
 *
 * @param anio_base Año base (denominador).
 * @param anio_destino Año destino (numerador).
 * @returns Factor >= 0 (típicamente ~1.0 para años cercanos).
 */
export function calcularFactorIpc(
  anio_base: number,
  anio_destino: number,
): number {
  const ipcBase = IPC_VALORES[anio_base];
  const ipcDestino = IPC_VALORES[anio_destino];
  if (ipcBase === undefined || ipcDestino === undefined) {
    return 1.0;
  }
  return ipcDestino / ipcBase;
}
