import type { Database as DatabaseType } from 'better-sqlite3';
import { crearConexion } from '../db';

/**
 * Fixture de test: crea una DB SQLite en memoria, aislada por llamada.
 *
 * Stub Phase 2.5.1 — solo abre conexión `:memory:`. Las migrations se
 * agregan en Phase 5.4 (cuando exista `migrations/index.ts` con la lista).
 *
 * Lifecycle = caller (D10): el test debe llamar `db.close()` en `finally` o `afterEach`.
 */
export function crearDBTest(): DatabaseType {
  return crearConexion(':memory:');
}
