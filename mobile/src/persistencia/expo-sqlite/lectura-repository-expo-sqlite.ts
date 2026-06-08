/**
 * Adapter expo-sqlite de `LecturaRepository` para la app movil.
 *
 * Espejo async de `src/persistencia/sqlite/lectura-repository-sqlite.ts`
 * (Node / better-sqlite3). Misma interfaz publica con todos los metodos
 * `Promise<>`. Diferencias principales:
 *  - `db.runAsync(sql, ...params)` y `db.getFirstAsync` / `db.getAllAsync`.
 *  - `result.lastInsertRowId` (camelCase) en lugar de
 *    `result.lastInsertRowid` (lowercase) de better-sqlite3.
 *  - La traduccion de errores SQLite usa substring matching sobre el
 *    mensaje (expo-sqlite no expone `.code` discreto).
 *
 * Mapeo Lectura <-> row identico al adapter Node (foto aplanada en
 * `evidencia_foto_path` / `evidencia_foto_hash`, opcionales como NULL).
 */

import type * as SQLite from 'expo-sqlite';
import type { Lectura } from '@dominio/captura-lecturas/types';
import type {
  FiltrosLectura,
  LecturaRepository,
} from '@dominio/persistencia/lectura-repository';

interface LecturaRow {
  readonly id_lectura: number;
  readonly id_medidor: number;
  readonly id_periodo: string;
  readonly id_operario: number;
  readonly lectura_actual: number;
  readonly lectura_anterior: number;
  readonly evidencia_foto_path: string | null;
  readonly evidencia_foto_hash: string | null;
  readonly estado_validacion: string;
  readonly observaciones: string | null;
  readonly timestamp_captura: string;
  readonly timestamp_sync: string | null;
  readonly estado_sync: string;
}

function fromRow(row: LecturaRow): Lectura {
  const lectura: Lectura = {
    id_lectura: row.id_lectura,
    id_medidor: row.id_medidor,
    id_periodo: row.id_periodo,
    id_operario: row.id_operario,
    lectura_actual: row.lectura_actual,
    lectura_anterior: row.lectura_anterior,
    estado_validacion: row.estado_validacion as Lectura['estado_validacion'],
    timestamp_captura: row.timestamp_captura,
    estado_sync: row.estado_sync as Lectura['estado_sync'],
    ...(row.evidencia_foto_path !== null && {
      evidencia: {
        foto_path: row.evidencia_foto_path,
        ...(row.evidencia_foto_hash !== null && { foto_hash: row.evidencia_foto_hash }),
      },
    }),
    ...(row.observaciones !== null && { observaciones: row.observaciones }),
    ...(row.timestamp_sync !== null && { timestamp_sync: row.timestamp_sync }),
  };
  return lectura;
}

const SQL_INSERT = `
  INSERT INTO lectura (
    id_medidor, id_periodo, id_operario, lectura_actual, lectura_anterior,
    evidencia_foto_path, evidencia_foto_hash, estado_validacion, observaciones,
    timestamp_captura, timestamp_sync, estado_sync
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const SQL_SELECT_BY_ID = `SELECT * FROM lectura WHERE id_lectura = ?`;
const SQL_SELECT_BY_PERIODO = `SELECT * FROM lectura WHERE id_periodo = ? ORDER BY id_lectura`;
const SQL_LIST_BY_MES = `SELECT * FROM lectura WHERE timestamp_captura LIKE ? || '%' ORDER BY id_lectura`;
const SQL_SELECT_PENDIENTES_SYNC = `SELECT * FROM lectura WHERE estado_sync = 'pendiente' ORDER BY id_lectura`;
const SQL_EXISTE = `SELECT 1 AS uno FROM lectura WHERE id_medidor = ? AND id_periodo = ? LIMIT 1`;
const SQL_UPDATE_SYNC = `
  UPDATE lectura SET estado_sync = ?, timestamp_sync = ?
  WHERE id_lectura = ?
`;
const SQL_UPDATE_VALIDACION = `
  UPDATE lectura SET estado_validacion = ? WHERE id_lectura = ?
`;

function traducirError(
  err: unknown,
  ctx: { id_medidor?: number; id_periodo?: string },
): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes('unique') &&
    ctx.id_medidor !== undefined &&
    ctx.id_periodo !== undefined
  ) {
    const e = new Error(
      `Ya existe una lectura para el medidor ${ctx.id_medidor} en el periodo ${ctx.id_periodo}`,
    );
    Object.defineProperty(e, 'cause', {
      value: {
        codigo: 'RESTRICCION_UNICIDAD',
        ctx: { id_medidor: ctx.id_medidor, id_periodo: ctx.id_periodo },
      },
      enumerable: true,
    });
    return e;
  }
  return err instanceof Error ? err : new Error(msg);
}

function lanzarLecturaNoEncontrada(id: number): never {
  const err = new Error(`Lectura con id ${id} no encontrada`);
  Object.defineProperty(err, 'cause', {
    value: { codigo: 'LECTURA_NO_ENCONTRADA', ctx: { id_lectura: id } },
    enumerable: true,
  });
  throw err;
}

type ParamSqlite = string | number | null;

interface SqlConParams {
  readonly sql: string;
  readonly params: readonly ParamSqlite[];
}

function aplicarFiltros(base: string, filtros?: FiltrosLectura): SqlConParams {
  if (!filtros) return { sql: `${base} ORDER BY id_lectura`, params: [] };
  const conds: string[] = [];
  const params: ParamSqlite[] = [];
  if (filtros.id_periodo !== undefined) {
    conds.push('id_periodo = ?');
    params.push(filtros.id_periodo);
  }
  if (filtros.id_medidor !== undefined) {
    conds.push('id_medidor = ?');
    params.push(filtros.id_medidor);
  }
  if (filtros.id_operario !== undefined) {
    conds.push('id_operario = ?');
    params.push(filtros.id_operario);
  }
  if (filtros.estado_sync !== undefined) {
    conds.push('estado_sync = ?');
    params.push(filtros.estado_sync);
  }
  if (filtros.estado_validacion !== undefined) {
    conds.push('estado_validacion = ?');
    params.push(filtros.estado_validacion);
  }
  const where = conds.length > 0 ? ` WHERE ${conds.join(' AND ')}` : '';
  return { sql: `${base}${where} ORDER BY id_lectura`, params };
}

export interface LecturaRepositoryExpoSqlite extends LecturaRepository {
  listarPorMes(mes: string): Promise<Lectura[]>;
  cerrar(): Promise<void>;
}

export function crearLecturaRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): LecturaRepositoryExpoSqlite {
  return {
    async guardar(lectura: Lectura): Promise<Lectura> {
      let info: SQLite.SQLiteRunResult;
      try {
        info = await db.runAsync(
          SQL_INSERT,
          lectura.id_medidor,
          lectura.id_periodo,
          lectura.id_operario,
          lectura.lectura_actual,
          lectura.lectura_anterior,
          lectura.evidencia?.foto_path ?? null,
          lectura.evidencia?.foto_hash ?? null,
          lectura.estado_validacion,
          lectura.observaciones ?? null,
          lectura.timestamp_captura,
          lectura.timestamp_sync ?? null,
          lectura.estado_sync,
        );
      } catch (e) {
        throw traducirError(e, {
          id_medidor: lectura.id_medidor,
          id_periodo: lectura.id_periodo,
        });
      }
      const idAsignado = Number(info.lastInsertRowId);
      const row = await db.getFirstAsync<LecturaRow>(SQL_SELECT_BY_ID, idAsignado);
      if (!row) {
        throw new Error('guardar: lectura no fue persistida (estado inesperado)');
      }
      return fromRow(row);
    },

    async obtenerPorId(id: number): Promise<Lectura | null> {
      const row = await db.getFirstAsync<LecturaRow>(SQL_SELECT_BY_ID, id);
      return row ? fromRow(row) : null;
    },

    async listarPorPeriodo(idPeriodo: string): Promise<Lectura[]> {
      const rows = await db.getAllAsync<LecturaRow>(SQL_SELECT_BY_PERIODO, idPeriodo);
      return rows.map(fromRow);
    },

    async listarPendientesSync(): Promise<Lectura[]> {
      const rows = await db.getAllAsync<LecturaRow>(SQL_SELECT_PENDIENTES_SYNC);
      return rows.map(fromRow);
    },

    async listar(filtros?: FiltrosLectura): Promise<Lectura[]> {
      const { sql, params } = aplicarFiltros('SELECT * FROM lectura', filtros);
      const rows = await db.getAllAsync<LecturaRow>(sql, ...params);
      return rows.map(fromRow);
    },

    async actualizarEstadoSync(
      id: number,
      estado: 'sincronizado' | 'error',
      timestampSync?: string,
    ): Promise<Lectura> {
      const existente = await db.getFirstAsync<LecturaRow>(SQL_SELECT_BY_ID, id);
      if (!existente) lanzarLecturaNoEncontrada(id);
      const ts = timestampSync ?? existente.timestamp_sync;
      await db.runAsync(SQL_UPDATE_SYNC, estado, ts, id);
      const row = await db.getFirstAsync<LecturaRow>(SQL_SELECT_BY_ID, id);
      return fromRow(row as LecturaRow);
    },

    async actualizarEstadoValidacion(
      id: number,
      estado: 'validado' | 'error',
    ): Promise<Lectura> {
      const existente = await db.getFirstAsync<LecturaRow>(SQL_SELECT_BY_ID, id);
      if (!existente) lanzarLecturaNoEncontrada(id);
      await db.runAsync(SQL_UPDATE_VALIDACION, estado, id);
      const row = await db.getFirstAsync<LecturaRow>(SQL_SELECT_BY_ID, id);
      return fromRow(row as LecturaRow);
    },

    async contar(filtros?: FiltrosLectura): Promise<number> {
      const { sql, params } = aplicarFiltros('SELECT COUNT(*) AS n FROM lectura', filtros);
      const row = await db.getFirstAsync<{ n: number }>(sql, ...params);
      return row?.n ?? 0;
    },

    async existeLectura(idMedidor: number, idPeriodo: string): Promise<boolean> {
      const row = await db.getFirstAsync<{ uno: number }>(
        SQL_EXISTE,
        idMedidor,
        idPeriodo,
      );
      return row !== null && row !== undefined;
    },

    async listarPorMes(mes: string): Promise<Lectura[]> {
      const rows = await db.getAllAsync<LecturaRow>(SQL_LIST_BY_MES, mes);
      return rows.filter((r) => r.id_medidor != null).map(fromRow);
    },

    async cerrar(): Promise<void> {
      await db.closeAsync();
    },
  };
}
