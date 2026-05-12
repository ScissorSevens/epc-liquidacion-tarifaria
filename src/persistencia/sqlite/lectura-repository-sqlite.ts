/**
 * Adapter SQLite de `LecturaRepository`.
 *
 * Mapeo Lectura <-> row:
 *  - `id_lectura` lo asigna SQLite via AUTOINCREMENT; el adapter lo lee de
 *    `lastInsertRowid` despues del INSERT y lo devuelve en el objeto.
 *  - `evidencia` (objeto opcional con foto_path/foto_hash) se aplana a dos
 *    columnas TEXT nullable. Al leer, si AMBAS son NULL se omite la prop.
 *    Si solo `foto_hash` es NULL pero `foto_path` no, se reconstruye con
 *    `foto_hash` undefined (es opcional dentro de EvidenciaFoto).
 *  - Campos opcionales (`observaciones`, `timestamp_sync`) se persisten
 *    como NULL cuando ausentes; al leer se omiten del objeto (nunca `null`).
 *
 * Errores: el mapper hexagonal de infra (`mapearErrorSqlite`) emite codigos
 * genericos. Este adapter conoce los mensajes de dominio en espaniol y
 * traduce el codigo `RESTRICCION_UNICIDAD` al mismo texto que emite el
 * adapter in-memory ("Ya existe una lectura para el medidor X en el
 * periodo Y"). Esto preserva el contrato de error visible al dominio.
 *
 * NOTA: el modulo `persistencia/lectura-repository.ts` no expone un
 * objeto MENSAJES_ERROR_LECTURA todavia. Cuando se cree, centralizar
 * estos textos ahi y consumirlos desde aca y desde el in-memory.
 * Actualmente viven duplicados en harness + in-memory + SQLite
 * (3 lugares, source-of-truth = harness).
 *
 * Hexagonal: persistencia pura. Sin eventos de auditoria; eso queda
 * para orquestadores `*ConRepo` (no existen aun para lecturas).
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type { Lectura } from '../../captura-lecturas/types';
import type { FiltrosLectura, LecturaRepository } from '../lectura-repository';
import { mapearErrorSqlite } from './errores';

export interface LecturaRepositorySqlite extends LecturaRepository {
  cerrar(): void;
}

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
  ) VALUES (
    @id_medidor, @id_periodo, @id_operario, @lectura_actual, @lectura_anterior,
    @evidencia_foto_path, @evidencia_foto_hash, @estado_validacion, @observaciones,
    @timestamp_captura, @timestamp_sync, @estado_sync
  )
`;

const SQL_SELECT_BY_ID = `SELECT * FROM lectura WHERE id_lectura = ?`;
const SQL_SELECT_BY_PERIODO = `SELECT * FROM lectura WHERE id_periodo = ? ORDER BY id_lectura`;
const SQL_SELECT_PENDIENTES_SYNC = `SELECT * FROM lectura WHERE estado_sync = 'pendiente' ORDER BY id_lectura`;
const SQL_EXISTE = `SELECT 1 FROM lectura WHERE id_medidor = ? AND id_periodo = ? LIMIT 1`;
const SQL_UPDATE_SYNC = `
  UPDATE lectura SET estado_sync = @estado_sync, timestamp_sync = @timestamp_sync
  WHERE id_lectura = @id_lectura
`;
const SQL_UPDATE_VALIDACION = `
  UPDATE lectura SET estado_validacion = @estado_validacion WHERE id_lectura = @id_lectura
`;

/**
 * Traduce errores SQLite del adapter a errores con mensaje de dominio.
 * Mismo patron hexagonal que `factura-repository-sqlite.ts`: el mapper
 * de infra habla CODIGOS, el adapter habla MENSAJES.
 */
function traducirErrorAdapter(
  err: unknown,
  ctx: { id_medidor?: number; id_periodo?: string },
): Error {
  const mapeado = mapearErrorSqlite(err, { tabla: 'lectura' });
  const codigo = mapeado.cause.codigo;
  if (
    codigo === 'RESTRICCION_UNICIDAD' &&
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
  return mapeado;
}

function lanzarLecturaNoEncontrada(id: number): never {
  const err = new Error(`Lectura con id ${id} no encontrada`);
  Object.defineProperty(err, 'cause', {
    value: { codigo: 'LECTURA_NO_ENCONTRADA', ctx: { id_lectura: id } },
    enumerable: true,
  });
  throw err;
}

function aplicarFiltros(base: string, filtros?: FiltrosLectura): {
  sql: string;
  params: unknown[];
} {
  if (!filtros) return { sql: `${base} ORDER BY id_lectura`, params: [] };
  const conds: string[] = [];
  const params: unknown[] = [];
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

export function crearLecturaRepositorySqlite(db: DatabaseType): LecturaRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtSelectByPeriodo = db.prepare(SQL_SELECT_BY_PERIODO);
  const stmtSelectPendientesSync = db.prepare(SQL_SELECT_PENDIENTES_SYNC);
  const stmtExiste = db.prepare(SQL_EXISTE);
  const stmtUpdateSync = db.prepare(SQL_UPDATE_SYNC);
  const stmtUpdateValidacion = db.prepare(SQL_UPDATE_VALIDACION);

  function toInsertParams(lectura: Lectura): Record<string, unknown> {
    return {
      id_medidor: lectura.id_medidor,
      id_periodo: lectura.id_periodo,
      id_operario: lectura.id_operario,
      lectura_actual: lectura.lectura_actual,
      lectura_anterior: lectura.lectura_anterior,
      evidencia_foto_path: lectura.evidencia?.foto_path ?? null,
      evidencia_foto_hash: lectura.evidencia?.foto_hash ?? null,
      estado_validacion: lectura.estado_validacion,
      observaciones: lectura.observaciones ?? null,
      timestamp_captura: lectura.timestamp_captura,
      timestamp_sync: lectura.timestamp_sync ?? null,
      estado_sync: lectura.estado_sync,
    };
  }

  return {
    async guardar(lectura: Lectura): Promise<Lectura> {
      let info;
      try {
        info = stmtInsert.run(toInsertParams(lectura));
      } catch (e) {
        throw traducirErrorAdapter(e, {
          id_medidor: lectura.id_medidor,
          id_periodo: lectura.id_periodo,
        });
      }
      const idAsignado = Number(info.lastInsertRowid);
      const row = stmtSelectById.get(idAsignado) as LecturaRow | undefined;
      if (!row) {
        throw new Error('guardar: lectura no fue persistida (estado inesperado)');
      }
      return fromRow(row);
    },

    async obtenerPorId(id: number): Promise<Lectura | null> {
      const row = stmtSelectById.get(id) as LecturaRow | undefined;
      return row ? fromRow(row) : null;
    },

    async listarPorPeriodo(idPeriodo: string): Promise<Lectura[]> {
      const rows = stmtSelectByPeriodo.all(idPeriodo) as LecturaRow[];
      return rows.map(fromRow);
    },

    async listarPendientesSync(): Promise<Lectura[]> {
      const rows = stmtSelectPendientesSync.all() as LecturaRow[];
      return rows.map(fromRow);
    },

    async listar(filtros?: FiltrosLectura): Promise<Lectura[]> {
      const { sql, params } = aplicarFiltros('SELECT * FROM lectura', filtros);
      const rows = db.prepare(sql).all(...params) as LecturaRow[];
      return rows.map(fromRow);
    },

    async actualizarEstadoSync(
      id: number,
      estado: 'sincronizado' | 'error',
      timestampSync?: string,
    ): Promise<Lectura> {
      const existente = stmtSelectById.get(id) as LecturaRow | undefined;
      if (!existente) lanzarLecturaNoEncontrada(id);
      // Si no se pasa timestampSync, se preserva el valor actual (puede ser NULL).
      const ts = timestampSync ?? existente!.timestamp_sync;
      stmtUpdateSync.run({ id_lectura: id, estado_sync: estado, timestamp_sync: ts });
      const row = stmtSelectById.get(id) as LecturaRow;
      return fromRow(row);
    },

    async actualizarEstadoValidacion(
      id: number,
      estado: 'validado' | 'error',
    ): Promise<Lectura> {
      const existente = stmtSelectById.get(id) as LecturaRow | undefined;
      if (!existente) lanzarLecturaNoEncontrada(id);
      stmtUpdateValidacion.run({ id_lectura: id, estado_validacion: estado });
      const row = stmtSelectById.get(id) as LecturaRow;
      return fromRow(row);
    },

    async contar(filtros?: FiltrosLectura): Promise<number> {
      const { sql, params } = aplicarFiltros('SELECT COUNT(*) AS n FROM lectura', filtros);
      // ORDER BY no tiene sentido en COUNT, pero no rompe; lo dejamos por simplicidad.
      const row = db.prepare(sql).get(...params) as { n: number };
      return row.n;
    },

    async existeLectura(idMedidor: number, idPeriodo: string): Promise<boolean> {
      const row = stmtExiste.get(idMedidor, idPeriodo);
      return row !== undefined;
    },

    cerrar(): void {
      db.close();
    },
  };
}
