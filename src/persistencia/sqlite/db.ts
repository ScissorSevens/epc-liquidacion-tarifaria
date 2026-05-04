import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Crea una conexión SQLite. Por default usa `:memory:` (D14).
 * Lifecycle = caller (D10): el llamador debe `db.close()`.
 *
 * Aplica PRAGMAs estándar:
 * - `foreign_keys = ON` (siempre)
 * - `journal_mode = WAL` (solo cuando es archivo en disco; `:memory:` no soporta WAL)
 */
export function crearConexion(rutaDB: string = ':memory:'): DatabaseType {
  const db = new Database(rutaDB);
  db.pragma('foreign_keys = ON');
  if (rutaDB !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  return db;
}
