/**
 * Validaciones del módulo PARAMETROS TARIFA — Res CRA 825/2017.
 *
 * Funciones PURAS que validan los insumos normativos del modelo
 * tarifario. Cada función lanza `Error` con la clave del catálogo
 * `MENSAJES_ERROR_PARAMETROS` embebida en el `.message` para que
 * la UI / tests puedan matchear sin acoplar al tipo de error.
 *
 * Por que throw y no devolver { ok: false } como en otros módulos:
 *   - Las validaciones de este archivo son REGULATORIAS (Art. 15).
 *   - Una falla es un "no-puedo-cumplir-la-norma", no un
 *     "warning recuperable". Lanzar es la convención del proyecto
 *     para invariantes rotos.
 *   - El caller puede wrapping con try/catch si quiere degradar a
 *     warning; el default falla ruidosamente.
 */

import { MENSAJES_ERROR_PARAMETROS } from './types';

/**
 * CMA mínimo normativo por servicio, en COP de diciembre 2016
 * (Res CRA 825/2017 Art. 15).
 *
 * Constantes congeladas: cambiarlas es un cambio regulatorio,
 * NO de código. Ver `__tests__/validaciones.test.ts` T-CMA-6.
 */
export const CMA_MINIMO_ACUEDUCTO = 2890;
export const CMA_MINIMO_ALCANTARILLADO = 2069;

/** Tipo de servicio para validación de CMA. */
export type Servicio = 'acueducto' | 'alcantarillado';

/**
 * Valida que `cma` sea al menos el mínimo normativo para `servicio`.
 *
 * Lanza `Error` con `.message` conteniendo la clave
 * `MENSAJES_ERROR_PARAMETROS.CMA_BAJO_MINIMO` si el CMA es
 * estrictamente menor al mínimo del servicio.
 *
 * No retorna nada: éxito = no throw. Esto matchea la convención
 * del módulo (los MENSAJES_ERROR_* están en `types.ts` y se
 * exponen ahí para que tests matcheen por string).
 *
 * @param cma CMA propuesto (COP, dic-2016).
 * @param servicio Servicio al que aplica el CMA.
 * @throws Error si cma < mínimo del servicio.
 */
export function validarCmaMinimo(cma: number, servicio: Servicio): void {
  const minimo =
    servicio === 'acueducto' ? CMA_MINIMO_ACUEDUCTO : CMA_MINIMO_ALCANTARILLADO;
  if (cma < minimo) {
    throw new Error(
      `CMA_BAJO_MINIMO: ${MENSAJES_ERROR_PARAMETROS.CMA_BAJO_MINIMO} (mínimo ${servicio}: $${minimo})`,
    );
  }
}
