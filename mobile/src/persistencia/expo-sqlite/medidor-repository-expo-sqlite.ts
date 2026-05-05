/**
 * Adapter expo-sqlite de `MedidorRepository` para la app movil.
 *
 * Espejo async de `src/persistencia/sqlite/medidor-repository-sqlite.ts`
 * (Node / better-sqlite3). Misma interfaz publica, todos los metodos
 * `Promise<>`. Diferencias principales:
 *  - `db.runAsync(sql, ...params)` para INSERT/UPDATE.
 *  - `db.getFirstAsync(sql, ...params)` para SELECT singular.
 *  - `db.getAllAsync(sql, ...params)` para SELECT multiple.
 *  - `result.lastInsertRowId` (camelCase, distinto de `lastInsertRowid`
 *    de better-sqlite3).
 *  - El mapeo de errores SQLite va por substring del mensaje (ver
 *    `traducir-error.ts`): expo-sqlite no expone `.code` discreto.
 *
 * Errores especificos:
 *  - UK violado en `numero_medidor` -> "Ya existe un medidor con
 *    numero 'X'" + cause.codigo='RESTRICCION_UNICIDAD'.
 *  - FK violada (id_suscriptor inexistente) -> "Suscriptor X no
 *    existe (FK invalida en medidor)" + cause.codigo='RESTRICCION_INTEGRIDAD'.
 *    OJO: requiere `PRAGMA foreign_keys = ON;` por sesion (lo hace
 *    `aplicarMigracionesAsync`). Sin ese PRAGMA, la FK se ignora
 *    silenciosamente y este branch nunca se dispara.
 *
 * `actualizar` y `eliminar` son stubs honestos — fuera de scope MVP,
 * igual que el adapter Node.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  ActualizarMedidorInput,
  Medidor,
  MedidorBorrador,
  MedidorRepository,
} from '@dominio/medidores';
import { mapearErrorExpoSqlite } from './traducir-error';

export interface MedidorRepositoryExpoSqlite extends MedidorRepository {
  cerrar(): Promise<void>;
}

interface MedidorRow {
  readonly id_medidor: number;
  readonly numero_medidor: string;
  readonly id_suscriptor: number;
  readonly fecha_instalacion: string;
  readonly estado: string;
  readonly observaciones: string | null;
  readonly created_at: string;
}

function fromRow(row: MedidorRow): Medidor {
  const m: Medidor = {
    id_medidor: row.id_medidor,
    numero_medidor: row.numero_medidor,
    id_suscriptor: row.id_suscriptor,
    fecha_instalacion: row.fecha_instalacion,
    estado: row.estado as Medidor['estado'],
    created_at: row.created_at,
    ...(row.observaciones !== null && { observaciones: row.observaciones }),
  };
  return m;
}

const SQL_INSERT = `
  INSERT INTO medidor (
    numero_medidor, id_suscriptor, fecha_instalacion, estado, observaciones
  ) VALUES (?, ?, ?, ?, ?)
`;

const SQL_SELECT_BY_ID = `SELECT * FROM medidor WHERE id_medidor = ?`;
const SQL_SELECT_BY_NUMERO = `SELECT * FROM medidor WHERE numero_medidor = ?`;
const SQL_EXISTE_POR_NUMERO = `SELECT 1 AS uno FROM medidor WHERE numero_medidor = ? LIMIT 1`;
const SQL_LISTAR_POR_SUSCRIPTOR = `SELECT * FROM medidor WHERE id_suscriptor = ? ORDER BY numero_medidor ASC`;
const SQL_LISTAR = `SELECT * FROM medidor ORDER BY numero_medidor ASC`;

function traducirError(
  err: unknown,
  ctx: { numero_medidor?: string; id_suscriptor?: number },
): Error {
  const mapeado = mapearErrorExpoSqlite(err, { tabla: 'medidor' });
  const codigo = mapeado.cause.codigo;

  if (codigo === 'RESTRICCION_UNICIDAD' && ctx.numero_medidor !== undefined) {
    const e = new Error(`Ya existe un medidor con numero '${ctx.numero_medidor}'`);
    Object.defineProperty(e, 'cause', {
      value: {
        codigo: 'RESTRICCION_UNICIDAD',
        ctx: { numero_medidor: ctx.numero_medidor },
      },
      enumerable: true,
    });
    return e;
  }

  if (codigo === 'RESTRICCION_INTEGRIDAD' && ctx.id_suscriptor !== undefined) {
    const e = new Error(
      `Suscriptor ${ctx.id_suscriptor} no existe (FK invalida en medidor)`,
    );
    Object.defineProperty(e, 'cause', {
      value: {
        codigo: 'RESTRICCION_INTEGRIDAD',
        ctx: { id_suscriptor: ctx.id_suscriptor },
      },
      enumerable: true,
    });
    return e;
  }

  return mapeado;
}

export function crearMedidorRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): MedidorRepositoryExpoSqlite {
  return {
    async crear(data: MedidorBorrador): Promise<Medidor> {
      let result: SQLite.SQLiteRunResult;
      try {
        result = await db.runAsync(
          SQL_INSERT,
          data.numero_medidor,
          data.id_suscriptor,
          data.fecha_instalacion,
          data.estado,
          data.observaciones ?? null,
        );
      } catch (e) {
        throw traducirError(e, {
          numero_medidor: data.numero_medidor,
          id_suscriptor: data.id_suscriptor,
        });
      }
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<MedidorRow>(SQL_SELECT_BY_ID, id);
      if (!row) {
        throw new Error('crear: medidor no fue persistido (estado inesperado)');
      }
      return fromRow(row);
    },

    async buscarPorId(id: number): Promise<Medidor | null> {
      const row = await db.getFirstAsync<MedidorRow>(SQL_SELECT_BY_ID, id);
      return row ? fromRow(row) : null;
    },

    async buscarPorNumero(numero: string): Promise<Medidor | null> {
      const row = await db.getFirstAsync<MedidorRow>(SQL_SELECT_BY_NUMERO, numero);
      return row ? fromRow(row) : null;
    },

    async existePorNumero(numero: string): Promise<boolean> {
      const row = await db.getFirstAsync<{ uno: number }>(
        SQL_EXISTE_POR_NUMERO,
        numero,
      );
      return row !== null;
    },

    async listarPorSuscriptor(idSuscriptor: number): Promise<Medidor[]> {
      const rows = await db.getAllAsync<MedidorRow>(
        SQL_LISTAR_POR_SUSCRIPTOR,
        idSuscriptor,
      );
      return rows.map(fromRow);
    },

    async listar(): Promise<Medidor[]> {
      const rows = await db.getAllAsync<MedidorRow>(SQL_LISTAR);
      return rows.map(fromRow);
    },

    async actualizar(_id: number, _cambios: ActualizarMedidorInput): Promise<Medidor> {
      throw new Error(
        'actualizar: no implementado todavia — fuera de scope MVP, ver post-entrega',
      );
    },

    async eliminar(_id: number): Promise<void> {
      throw new Error(
        'eliminar: no implementado todavia — fuera de scope MVP, ver post-entrega',
      );
    },

    async cerrar(): Promise<void> {
      await db.closeAsync();
    },
  };
}
