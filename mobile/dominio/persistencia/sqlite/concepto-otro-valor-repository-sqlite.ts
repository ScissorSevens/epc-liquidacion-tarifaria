/**
 * Adapter SQLite (better-sqlite3) del repositorio `ConceptoOtroValorRepository`.
 *
 * Justificacion: ver `dominio/concepto-otro-valor/types.ts`. Este adapter
 * es la implementación para Node / tests del root. La version Expo SQLite
 * es un espejo en `mobile/src/persistencia/expo-sqlite/`.
 *
 * TDD: este archivo implementa los tests en
 * `__tests__/concepto-otro-valor-repository-sqlite.test.ts`. Sigue los
 * 8 escenarios del bloque B del change `factura-compliance-hardening`:
 *  - T-5.6: seed completo tras migration 021
 *  - T-5.7: idempotencia (re-aplicar no rompe)
 *  - T-5.8: listar() retorna códigos en mayúsculas
 *  - T-5.9: requiere_glosa coherente por concepto
 *  - T-5.10: activo se serializa como boolean
 *  - T-5.11: created_at ISO 8601
 *  - T-5.12: __migraciones_aplicadas registra version 21 tras apply
 *  - T-5.13: orden estable de listar
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { migrations } from './migrations';
import { ejecutarMigrations } from './migration-runner';
import type {
  ConceptoOtroValor,
  ConceptoOtroValorRepository,
} from '../../concepto-otro-valor/types';

interface ConceptoRow {
  readonly id_concepto: number;
  readonly codigo: string;
  readonly descripcion: string;
  readonly version: string;
  readonly activo: number;
  readonly requiere_glosa: number;
  readonly created_at: string;
}

function fromRow(row: ConceptoRow): ConceptoOtroValor {
  return {
    idConcepto: row.id_concepto,
    codigo: row.codigo,
    descripcion: row.descripcion,
    version: row.version,
    activo: row.activo === 1,
    requiereGlosa: row.requiere_glosa === 1,
    createdAt: row.created_at,
  };
}

export interface ConceptoOtroValorRepositorySqliteOptions {
  /** Si true, aplica la migration 021 antes del primer uso.
   * Default true para que tests sin setup manual funcionen. */
  readonly autoejecutarMigrations?: boolean;
}

export function crearConceptoOtroValorRepositorySqlite(
  db: DatabaseType,
  options: ConceptoOtroValorRepositorySqliteOptions = {},
): ConceptoOtroValorRepository {
  if (options.autoejecutarMigrations ?? true) {
    ejecutarMigrations(db, migrations);
  }

  const stmtListarActivos = db.prepare(
    'SELECT * FROM concepto_otro_valor WHERE activo = ? ORDER BY id_concepto',
  );
  const stmtListarTodos = db.prepare(
    'SELECT * FROM concepto_otro_valor ORDER BY id_concepto',
  );
  const stmtBuscarPorCodigo = db.prepare(
    'SELECT * FROM concepto_otro_valor WHERE codigo = ?',
  );

  return {
    async listar(activo?: boolean): Promise<readonly ConceptoOtroValor[]> {
      const rows = (
        activo === undefined
          ? (stmtListarTodos.all() as ConceptoRow[])
          : (stmtListarActivos.all(activo ? 1 : 0) as ConceptoRow[])
      ).map(fromRow);
      return Object.freeze(rows);
    },
    async buscarPorCodigo(codigo: string): Promise<ConceptoOtroValor | null> {
      // Busqueda case-insensitive (los codigos se canonicalizan en UPPER
      // al sembrarlos y al consultarlos).
      const row = stmtBuscarPorCodigo.get(codigo.toUpperCase()) as
        | ConceptoRow
        | undefined;
      return row ? fromRow(row) : null;
    },
  };
}
