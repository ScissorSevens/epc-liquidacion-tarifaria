import type { Database as DatabaseType } from 'better-sqlite3';
import { transaccion } from './transaccion';
import { aplicarMigration020IdempotenteNode } from './migraciones-idempotente';

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
 *
 * Migration 020 (factura-compliance) tiene un caso especial: SQLite < 3.35 no
 * soporta `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, asi que si la DB fue
 * restaurada parcialmente (user_version atras del schema) re-ejecutar la
 * migration tira "duplicate column". Para esta version llamamos al helper
 * `aplicarMigration020IdempotenteNode` que consulta `PRAGMA table_info`
 * antes de cada ALTER. Ver `migraciones-idempotente.ts`.
 */
export function ejecutarMigrations(db: DatabaseType, migrations: readonly Migration[]): void {
  const versionActual = db.pragma('user_version', { simple: true }) as number;
  const pendientes = migrations
    .filter((m) => m.version > versionActual)
    .slice()
    .sort((a, b) => a.version - b.version);
  for (const m of pendientes) {
    transaccion(db, () => {
      if (m.version === 20) {
        // Migration 020: idempotente via PRAGMA table_info. Re-ejecuciones
        // seguras (N passes no duplican columnas ni rompen el schema).
        aplicarMigration020IdempotenteNode(db, m.sql);
      } else {
        db.exec(m.sql);
      }
      db.pragma(`user_version = ${m.version}`);
    });
  }
}
