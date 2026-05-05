/**
 * Adapter expo-sqlite de `FacturaRepository` para la app movil.
 *
 * Espejo async de `src/factura/factura-repository-sqlite.ts` (Node /
 * better-sqlite3). Misma interfaz publica con todos los metodos
 * `Promise<>`. Diferencias principales:
 *  - `db.runAsync(sql, ...params)` en lugar de `stmt.run(params)`.
 *  - `db.getFirstAsync(sql, ...params)` y `db.getAllAsync(sql, ...params)`.
 *  - El mapeo de errores SQLite es PARCIAL aca: `expo-sqlite` no expone
 *    los mismos `.code` que better-sqlite3, asi que detectamos por
 *    substring en el `.message` (UNIQUE / CHECK / NOT NULL). Suficiente
 *    para preservar la semantica de dominio en la app movil.
 *  - Logica de transicion legal y construccion de `cause` espeja al
 *    adapter Node verbatim.
 *
 * IMPORTANTE: este adapter NO es testeado por jest del root. La
 * validacion contractual vive en los tests Node del adapter espejo. Si
 * cambia algo del contrato, espejarlo aca a mano.
 */

import type * as SQLite from 'expo-sqlite';
import { esTransicionLegal } from '@dominio/factura/factura';
import {
  MENSAJES_ERROR_FACTURA,
  type EstadoFactura,
  type Factura,
  type FacturaRepository,
  type FacturaSnapshot,
} from '@dominio/factura/types';

interface FacturaRow {
  readonly id: string;
  readonly numero_factura: string;
  readonly estado: string;
  readonly fecha_emision: string;
  readonly snapshot: string;
  readonly hash: string;
  readonly liquidacion_id: string;
  readonly id_periodo: string;
  readonly id_suscriptor: number;
  readonly created_at: string;
  readonly motivo_anulacion: string | null;
  readonly fecha_anulacion: string | null;
  readonly reemplaza_a: string | null;
}

function toRow(factura: Factura): {
  id: string;
  numero_factura: string;
  estado: string;
  fecha_emision: string;
  snapshot: string;
  hash: string;
  liquidacion_id: string;
  id_periodo: string;
  id_suscriptor: number;
  created_at: string;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  reemplaza_a: string | null;
} {
  return {
    id: factura.id,
    numero_factura: factura.numero_factura,
    estado: factura.estado,
    fecha_emision: factura.fecha_emision,
    snapshot: JSON.stringify(factura.snapshot),
    hash: factura.hash,
    liquidacion_id: factura.snapshot.liquidacion.id,
    id_periodo: factura.snapshot.periodo.id_periodo,
    id_suscriptor: parseInt(factura.snapshot.suscriptor.codigo, 10),
    created_at: factura.created_at,
    motivo_anulacion: factura.motivo_anulacion ?? null,
    fecha_anulacion: factura.fecha_anulacion ?? null,
    reemplaza_a: factura.reemplaza_a ?? null,
  };
}

function fromRow(row: FacturaRow): Factura {
  const snapshot = JSON.parse(row.snapshot) as FacturaSnapshot;
  const factura: Factura = {
    id: row.id,
    numero_factura: row.numero_factura,
    estado: row.estado as Factura['estado'],
    fecha_emision: row.fecha_emision,
    snapshot,
    hash: row.hash,
    created_at: row.created_at,
    ...(row.motivo_anulacion !== null && { motivo_anulacion: row.motivo_anulacion }),
    ...(row.fecha_anulacion !== null && { fecha_anulacion: row.fecha_anulacion }),
    ...(row.reemplaza_a !== null && { reemplaza_a: row.reemplaza_a }),
  };
  return factura;
}

const SQL_INSERT = `
  INSERT INTO factura (
    id, numero_factura, estado, fecha_emision, snapshot, hash,
    liquidacion_id, id_periodo, id_suscriptor, created_at,
    motivo_anulacion, fecha_anulacion, reemplaza_a
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SQL_SELECT_BY_ID = `SELECT * FROM factura WHERE id = ?`;
const SQL_SELECT_BY_PERIODO = `SELECT * FROM factura WHERE id_periodo = ? ORDER BY rowid`;
const SQL_SELECT_BY_SUSCRIPTOR = `SELECT * FROM factura WHERE id_suscriptor = ? ORDER BY rowid`;
const SQL_SELECT_ALL = `SELECT * FROM factura ORDER BY rowid`;
const SQL_UPDATE = `
  UPDATE factura SET
    estado = ?,
    motivo_anulacion = ?,
    fecha_anulacion = ?
  WHERE id = ?
`;

function lanzarTransicionIlegal(
  actual: EstadoFactura,
  intentada: EstadoFactura,
): never {
  const err = new Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL);
  Object.defineProperty(err, 'cause', {
    value: { codigo: 'TRANSICION_ILEGAL', actual, intentada },
    enumerable: true,
  });
  throw err;
}

/**
 * Traduce errores de expo-sqlite a errores de dominio. expo-sqlite no
 * expone codigos discretos como better-sqlite3, asi que identificamos
 * por substring del mensaje. Es defensa best-effort: el contrato real
 * del repo (validacion previa en orquestadores) sigue intacto.
 */
function traducirError(
  err: unknown,
  ctx: { liquidacion_id?: string },
): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('unique') || lower.includes('constraint failed: factura.liquidacion_id')) {
    const e = new Error(MENSAJES_ERROR_FACTURA.RESTRICCION_UNICIDAD);
    Object.defineProperty(e, 'cause', {
      value: {
        codigo: 'RESTRICCION_UNICIDAD',
        ctx: { liquidacion_id: ctx.liquidacion_id },
      },
      enumerable: true,
    });
    return e;
  }
  if (lower.includes('check constraint') && lower.includes('estado')) {
    const e = new Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL);
    Object.defineProperty(e, 'cause', {
      value: { codigo: 'TRANSICION_ILEGAL' },
      enumerable: true,
    });
    return e;
  }
  return err instanceof Error ? err : new Error(msg);
}

export interface FacturaRepositoryExpoSqlite extends FacturaRepository {
  cerrar(): Promise<void>;
}

export function crearFacturaRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): FacturaRepositoryExpoSqlite {
  return {
    async crear(factura: Factura): Promise<Factura> {
      const row = toRow(factura);
      try {
        await db.runAsync(
          SQL_INSERT,
          row.id,
          row.numero_factura,
          row.estado,
          row.fecha_emision,
          row.snapshot,
          row.hash,
          row.liquidacion_id,
          row.id_periodo,
          row.id_suscriptor,
          row.created_at,
          row.motivo_anulacion,
          row.fecha_anulacion,
          row.reemplaza_a,
        );
      } catch (e) {
        throw traducirError(e, { liquidacion_id: row.liquidacion_id });
      }
      const persistida = await db.getFirstAsync<FacturaRow>(
        SQL_SELECT_BY_ID,
        factura.id,
      );
      if (!persistida) {
        throw new Error('crear: factura no fue persistida (estado inesperado)');
      }
      return fromRow(persistida);
    },

    async buscarPorId(id: string): Promise<Factura | null> {
      const row = await db.getFirstAsync<FacturaRow>(SQL_SELECT_BY_ID, id);
      return row ? fromRow(row) : null;
    },

    async buscarPorPeriodo(idPeriodo: string): Promise<readonly Factura[]> {
      const rows = await db.getAllAsync<FacturaRow>(
        SQL_SELECT_BY_PERIODO,
        idPeriodo,
      );
      return rows.map(fromRow);
    },

    async buscarPorSuscriptor(idSuscriptor: number): Promise<readonly Factura[]> {
      const rows = await db.getAllAsync<FacturaRow>(
        SQL_SELECT_BY_SUSCRIPTOR,
        idSuscriptor,
      );
      return rows.map(fromRow);
    },

    async actualizar(id, cambios): Promise<Factura> {
      const existenteRow = await db.getFirstAsync<FacturaRow>(
        SQL_SELECT_BY_ID,
        id,
      );
      if (!existenteRow) {
        throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
      }
      const existente = fromRow(existenteRow);
      if (cambios.estado !== existente.estado) {
        if (!esTransicionLegal(existente.estado, cambios.estado)) {
          lanzarTransicionIlegal(existente.estado, cambios.estado);
        }
      }
      const motivo = cambios.motivo_anulacion ?? existente.motivo_anulacion ?? null;
      const fecha = cambios.fecha_anulacion ?? existente.fecha_anulacion ?? null;
      try {
        await db.runAsync(SQL_UPDATE, cambios.estado, motivo, fecha, id);
      } catch (e) {
        throw traducirError(e, {
          liquidacion_id: existente.snapshot.liquidacion.id,
        });
      }
      const row = await db.getFirstAsync<FacturaRow>(SQL_SELECT_BY_ID, id);
      if (!row) {
        throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
      }
      return fromRow(row);
    },

    async listar(): Promise<readonly Factura[]> {
      const rows = await db.getAllAsync<FacturaRow>(SQL_SELECT_ALL);
      return rows.map(fromRow);
    },

    async cerrar(): Promise<void> {
      await db.closeAsync();
    },
  };
}
