/**
 * Módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Funciones puras (excepto orquestadores que reciben repo). Errores como
 * `throw new Error(MENSAJES_ERROR_FACTURA.X)`. deepFreeze garantiza
 * inmutabilidad recursiva.
 */

import type { EmitirFacturaInput, Factura } from './types';

/**
 * Stub inicial — Phase 1 (estructural). La implementación real llega
 * en Phase 2 con TDD ciclo a ciclo.
 */
export function emitirFactura(_input: EmitirFacturaInput): Factura {
  throw new Error('not implemented');
}
