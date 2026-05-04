import type { Database as DatabaseType } from 'better-sqlite3';
import { transaccion } from './transaccion';

/**
 * Una migration SQLite versionada.
 * - `version`: entero positivo, monotónico ascendente.
 * - `nombre`: identificador legible (ej. "001_factura").
 * - `sql`: DDL/DML a ejecutar.
 */
export interface Migration {
  readonly version: number;
  readonly nombre: string;
  readonly sql: string;
}

/**
 * Ejecuta `migrations` aplicando solo las que tengan `version` > `user_version` actual.
 *
 * Implementación mínima (cycle 2.3.1): aplica todas las recibidas en orden de array
 * y setea `user_version = max(versions)`.
 *
 * Triangulations futuras:
 * - 2.3.2 idempotencia (skip ya aplicadas)
 * - 2.3.3 rollback en fallo
 * - 2.3.4 ordenamiento por `version` asc
 */
export function ejecutarMigrations(db: DatabaseType, migrations: readonly Migration[]): void {
  const versionActual = db.pragma('user_version', { simple: true }) as number;
  const pendientes = migrations.filter((m) => m.version > versionActual);
  for (const m of pendientes) {
    transaccion(db, () => {
      db.exec(m.sql);
      db.pragma(`user_version = ${m.version}`);
    });
  }
}
