import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Ejecuta `fn` dentro de una transacción SQLite síncrona.
 * - Éxito: COMMIT y devuelve el valor de `fn`.
 * - Excepción dentro de `fn`: ROLLBACK y re-lanza el error tal cual.
 *
 * Helper liviano que no depende de `db.transaction()` para mantener control
 * explícito de BEGIN/COMMIT/ROLLBACK (D3 / R3).
 */
export function transaccion<T>(db: DatabaseType, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
