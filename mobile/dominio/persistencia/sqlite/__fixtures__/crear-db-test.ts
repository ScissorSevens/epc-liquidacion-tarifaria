import type { Database as DatabaseType } from 'better-sqlite3';
import { crearConexion } from '../db';
import { ejecutarMigrations } from '../migration-runner';
import { migrations } from '../migrations';

/**
 * Fixture de test: crea una DB SQLite en memoria con todas las migrations
 * aplicadas. Pensada para tests de adapter (Phase 7+) que necesitan el
 * schema completo.
 *
 * Lifecycle = caller (D10): el test debe llamar `db.close()` en `finally` o `afterEach`.
 */
export function crearDBTest(): DatabaseType {
  const db = crearConexion(':memory:');
  ejecutarMigrations(db, migrations);
  return db;
}
