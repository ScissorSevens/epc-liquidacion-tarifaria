/**
 * Tipos de dominio para Operario — app móvil.
 *
 * Espejo de `dominio/operarios/types.ts` con dos diferencias intencionales:
 *  1. `rol` y `estado` se mantienen como string permisivo (no enums del
 *     dominio) — la app solo consume estos valores, no los valida runtime.
 *  2. `dispositivo_id` y `created_at` son opcionales.
 *
 * PUNTO A (Login real local): `password_hash` SI se almacena en mobile.
 * Es SHA-256 (no plain), generado por el `Hasher` del bootstrap. Es la
 * única forma de validar login offline contra SQLite. Trade-off
 * documentado en TICKET-EPIC-LOGIN-001 / PUNTO A (2026-07-09).
 */

export interface Operario {
  id_operario: number;
  id_prestador: number;
  numero_cedula: string;
  nombre: string;
  email: string;
  /**
   * Hash SHA-256 de la contraseña del operario. Persistido para permitir
   * login offline (PUNTO A). NO incluir el password en claro en ningún
   * punto del flujo.
   */
  password_hash: string;
  rol: 'operario' | 'admin' | string;
  estado: 'activo' | 'inactivo' | string;
  dispositivo_id?: string;
  created_at?: string;
}
