/**
 * Adapter SQLite de `FacturaRepository`.
 *
 * Phase 7 Batch 4 (persistencia-sqlite). Implementacion en construccion
 * via TDD — cada cycle agrega comportamiento minimo para satisfacer
 * un scenario del contract harness `runFacturaRepositoryContract`.
 *
 * Hexagonal: persistencia pura. NO emite eventos de auditoria — esa
 * responsabilidad sigue en orquestadores `*ConRepo` (D8).
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type { Factura, FacturaRepository } from './types';

export interface FacturaRepositorySqlite extends FacturaRepository {
  cerrar(): void;
}

export function crearFacturaRepositorySqlite(_db: DatabaseType): FacturaRepositorySqlite {
  throw new Error('crearFacturaRepositorySqlite: pendiente de implementacion (Phase 7)');
}

// referencia para evitar warning de import no usado mientras se construye
void ({} as Factura);
