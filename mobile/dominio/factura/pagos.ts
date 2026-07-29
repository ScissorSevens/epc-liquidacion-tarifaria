/**
 * Helpers de verificacion y pago de la factura.
 *
 * - calcularCodigoVerificacion: SHA-256 del hash canónico de la factura,
 *   truncado a 16 chars hex. Es un codigo legible + verificable por
 *   el operario / el auditor sin necesidad de correr el motor.
 * - generarReferenciaPago: UUID v4 determinista (vía IdGenerator).
 * - generarQrPago: string `${prefijo}|${referencia_pago}|${timestamp}`
 *   compatible con lectores QR de banca virtual. Formato documentado
 *   en el spec del sistema de pagos.
 *
 * Todos los helpers son PUROS. No mutan la factura, no tocan persistencia.
 */

import type { Factura } from './types';
import type { Hasher, IdGenerator } from '../shared/ports';

/**
 * Calcula el codigo de verificacion de 16 chars hex.
 * SHA-256(hash_canonico) truncado a 16 chars.
 */
export function calcularCodigoVerificacion(factura: Factura): string {
  const hash = factura.hash;
  // Tomamos 16 chars hex de la posicion 0..16 del hash canonico.
  // Si el hash es < 16 chars (hasher fake en tests), padStart con '0'.
  if (hash.length >= 16) {
    return hash.slice(0, 16);
  }
  return hash.padStart(16, '0');
}

/**
 * Genera una referencia de pago unica.
 * Tipicamente UUID v4 via el `IdGenerator` inyectado.
 */
export function generarReferenciaPago(idGen: IdGenerator): string {
  return idGen.uuid();
}

/**
 * Formato QR para banca virtual:
 *   EPC|{referencia_pago}|{timestamp}
 *
 * Por que formato pipe: es el patron que aceptan los lectores QR de
 * las apps bancarias. `EPC` es el codigo de la empresa prestadora.
 *
 * El timestamp es ISO 8601 — alinea con el formato de fecha de la
 * factura para que sistemas externos puedan parsearlo sin ambiguedad.
 */
export function generarQrPago(
  factura: Factura,
  referenciaPago: string,
  timestamp: string,
): string {
  const prefijo = 'EPC';
  return `${prefijo}|${referenciaPago}|${timestamp}`;
}

// Re-export Hasher for callers that want to use it consistently.
export type { Hasher, IdGenerator, Factura };
