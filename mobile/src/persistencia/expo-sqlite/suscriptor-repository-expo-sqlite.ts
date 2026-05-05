/**
 * Adapter expo-sqlite de `SuscriptorRepository` para la app movil.
 *
 * Espejo async de `src/persistencia/sqlite/suscriptor-repository-sqlite.ts`
 * (Node / better-sqlite3). Misma interfaz publica, todos los metodos
 * `Promise<>`. Diferencias principales:
 *  - `db.runAsync(sql, ...params)` para INSERT/UPDATE.
 *  - `db.getFirstAsync(sql, ...params)` para SELECT singular.
 *  - `db.getAllAsync(sql, ...params)` para SELECT multiple.
 *  - `result.lastInsertRowId` (camelCase, distinto de `lastInsertRowid`
 *    de better-sqlite3).
 *  - El mapeo de errores SQLite va por substring del mensaje (ver
 *    `traducir-error.ts`): expo-sqlite no expone `.code` discreto.
 *  - `actualizar` y `eliminar` son stubs honestos — fuera de scope MVP,
 *    igual que el adapter Node.
 *
 * IMPORTANTE: este adapter NO esta cubierto por jest del root (no hay
 * infra jest mobile). Validacion contractual: tests Node del adapter
 * espejo. Si cambia el contrato, espejarlo aca a mano.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  ActualizarSuscriptorInput,
  Suscriptor,
  SuscriptorBorrador,
  SuscriptorRepository,
} from '@dominio/suscriptores';
import { mapearErrorExpoSqlite } from './traducir-error';

export interface SuscriptorRepositoryExpoSqlite extends SuscriptorRepository {
  cerrar(): Promise<void>;
}

interface SuscriptorRow {
  readonly id_suscriptor: number;
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly direccion: string;
  readonly estrato: number;
  readonly matricula_inmobiliaria: string | null;
  readonly numero_catastral: string | null;
  readonly estado: string;
  readonly created_at: string;
}

function fromRow(row: SuscriptorRow): Suscriptor {
  const sus: Suscriptor = {
    id_suscriptor: row.id_suscriptor,
    codigo: row.codigo,
    nombre_apellidos: row.nombre_apellidos,
    direccion: row.direccion,
    estrato: row.estrato as Suscriptor['estrato'],
    estado: row.estado as Suscriptor['estado'],
    created_at: row.created_at,
    ...(row.matricula_inmobiliaria !== null && {
      matricula_inmobiliaria: row.matricula_inmobiliaria,
    }),
    ...(row.numero_catastral !== null && {
      numero_catastral: row.numero_catastral,
    }),
  };
  return sus;
}

const SQL_INSERT = `
  INSERT INTO suscriptor (
    codigo, nombre_apellidos, direccion, estrato,
    matricula_inmobiliaria, numero_catastral, estado
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const SQL_SELECT_BY_ID = `SELECT * FROM suscriptor WHERE id_suscriptor = ?`;
const SQL_SELECT_BY_CODIGO = `SELECT * FROM suscriptor WHERE codigo = ?`;
const SQL_EXISTE_POR_CODIGO = `SELECT 1 AS uno FROM suscriptor WHERE codigo = ? LIMIT 1`;
// Listar ordenado por codigo ASC (igual que el adapter Node): es el
// orden natural de presentacion para listas de clientes.
const SQL_LISTAR = `SELECT * FROM suscriptor ORDER BY codigo ASC`;

/**
 * Traduce errores expo-sqlite a mensajes de dominio especificos para
 * Suscriptor. Espeja la logica de `traducirErrorAdapter` del adapter
 * Node, pero reemplaza `mapearErrorSqlite` por `mapearErrorExpoSqlite`.
 */
function traducirError(err: unknown, ctx: { codigo?: string }): Error {
  const mapeado = mapearErrorExpoSqlite(err, { tabla: 'suscriptor' });
  if (mapeado.cause.codigo === 'RESTRICCION_UNICIDAD' && ctx.codigo !== undefined) {
    const e = new Error(`Ya existe un suscriptor con codigo '${ctx.codigo}'`);
    Object.defineProperty(e, 'cause', {
      value: { codigo: 'RESTRICCION_UNICIDAD', ctx: { codigo: ctx.codigo } },
      enumerable: true,
    });
    return e;
  }
  return mapeado;
}

export function crearSuscriptorRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): SuscriptorRepositoryExpoSqlite {
  return {
    async crear(data: SuscriptorBorrador): Promise<Suscriptor> {
      let result: SQLite.SQLiteRunResult;
      try {
        result = await db.runAsync(
          SQL_INSERT,
          data.codigo,
          data.nombre_apellidos,
          data.direccion,
          data.estrato,
          data.matricula_inmobiliaria ?? null,
          data.numero_catastral ?? null,
          data.estado,
        );
      } catch (e) {
        throw traducirError(e, { codigo: data.codigo });
      }
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_ID, id);
      if (!row) {
        throw new Error('crear: suscriptor no fue persistido (estado inesperado)');
      }
      return fromRow(row);
    },

    async buscarPorId(id: number): Promise<Suscriptor | null> {
      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_ID, id);
      return row ? fromRow(row) : null;
    },

    async buscarPorCodigo(codigo: string): Promise<Suscriptor | null> {
      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_CODIGO, codigo);
      return row ? fromRow(row) : null;
    },

    async existePorCodigo(codigo: string): Promise<boolean> {
      const row = await db.getFirstAsync<{ uno: number }>(
        SQL_EXISTE_POR_CODIGO,
        codigo,
      );
      return row !== null;
    },

    async listar(): Promise<Suscriptor[]> {
      const rows = await db.getAllAsync<SuscriptorRow>(SQL_LISTAR);
      return rows.map(fromRow);
    },

    async actualizar(_id: number, _cambios: ActualizarSuscriptorInput): Promise<Suscriptor> {
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
