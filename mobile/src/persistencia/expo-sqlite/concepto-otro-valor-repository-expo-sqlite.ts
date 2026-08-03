/**
 * Adapter Expo SQLite del repositorio `ConceptoOtroValorRepository`.
 *
 * Espejo de `mobile/dominio/persistencia/sqlite/concepto-otro-valor-repository-sqlite.ts`
 * (better-sqlite3 / Node). Misma interfaz publica; diferencias:
 *  - `db.getAllAsync(sql, ...params)` y `db.getFirstAsync(sql, ...params)`.
 *  - `db.execAsync(sql)` para ejecucion multiple.
 *  - Esta variante NO llama a `ejecutarMigrations` automaticamente —
 *    en runtime Expo, `aplicarMigracionesAsync` corre al bootstrap.
 *    Tests in-memory setean la tabla manualmente.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  ConceptoOtroValor,
  ConceptoOtroValorRepository,
} from '@dominio/concepto-otro-valor/types';

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

export interface ConceptoOtroValorRepositoryExpoSqlite
  extends ConceptoOtroValorRepository {
  cerrar(): Promise<void>;
}

export function crearConceptoOtroValorRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): ConceptoOtroValorRepositoryExpoSqlite {
  return {
    async listar(activo?: boolean): Promise<readonly ConceptoOtroValor[]> {
      const rows =
        activo === undefined
          ? await db.getAllAsync<ConceptoRow>(
              'SELECT * FROM concepto_otro_valor ORDER BY id_concepto',
            )
          : await db.getAllAsync<ConceptoRow>(
              'SELECT * FROM concepto_otro_valor WHERE activo = ? ORDER BY id_concepto',
              activo ? 1 : 0,
            );
      return Object.freeze(rows.map(fromRow));
    },

    async buscarPorCodigo(codigo: string): Promise<ConceptoOtroValor | null> {
      const row = (await db.getFirstAsync<ConceptoRow>(
        'SELECT * FROM concepto_otro_valor WHERE codigo = ?',
        codigo.toUpperCase(),
      )) ?? null;
      return row ? fromRow(row) : null;
    },

    async cerrar(): Promise<void> {
      await db.closeAsync();
    },
  };
}
