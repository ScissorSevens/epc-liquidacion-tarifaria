import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Crea una conexión SQLite. Por default usa `:memory:` (D14).
 * Lifecycle = caller (D10): el llamador debe `db.close()`.
 */
export function crearConexion(rutaDB: string = ':memory:'): DatabaseType {
  return new Database(rutaDB);
}
