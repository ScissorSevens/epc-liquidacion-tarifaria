/**
 * Adapter SQLite de `FacturaRepository`.
 *
 * Phase 7 Batch 4 (persistencia-sqlite). Mapeo Factura ↔ row:
 * - `snapshot` se persiste como TEXT con `JSON.stringify` (D15 — JSON
 *   directo, sin helper canonico; suficiente para round-trip fiel).
 * - `id_suscriptor` (INTEGER en schema) se deriva de `snapshot.suscriptor.codigo`
 *   con `parseInt`. El catalogo de suscriptores hoy mantiene `codigo` como
 *   string que es la representacion del id numerico.
 * - `id_periodo`, `liquidacion_id` viven denormalizados como TEXT para
 *   indices y queries `buscarPorPeriodo`.
 * - Columnas opcionales (`motivo_anulacion`, `fecha_anulacion`,
 *   `reemplaza_a`) se almacenan como NULL cuando ausentes; al leer se
 *   omiten del objeto (nunca `null`, D12).
 *
 * Hexagonal: persistencia pura. NO emite eventos de auditoria — esa
 * responsabilidad sigue en orquestadores `*ConRepo` (D8).
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type { Factura, FacturaRepository, FacturaSnapshot } from './types';

export interface FacturaRepositorySqlite extends FacturaRepository {
  cerrar(): void;
}

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
  ) VALUES (
    @id, @numero_factura, @estado, @fecha_emision, @snapshot, @hash,
    @liquidacion_id, @id_periodo, @id_suscriptor, @created_at,
    @motivo_anulacion, @fecha_anulacion, @reemplaza_a
  )
`;

const SQL_SELECT_BY_ID = `SELECT * FROM factura WHERE id = ?`;
const SQL_SELECT_BY_PERIODO = `SELECT * FROM factura WHERE id_periodo = ? ORDER BY rowid`;
const SQL_SELECT_BY_SUSCRIPTOR = `SELECT * FROM factura WHERE id_suscriptor = ? ORDER BY rowid`;
const SQL_SELECT_ALL = `SELECT * FROM factura ORDER BY rowid`;

export function crearFacturaRepositorySqlite(db: DatabaseType): FacturaRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtSelectByPeriodo = db.prepare(SQL_SELECT_BY_PERIODO);
  const stmtSelectBySuscriptor = db.prepare(SQL_SELECT_BY_SUSCRIPTOR);
  const stmtSelectAll = db.prepare(SQL_SELECT_ALL);

  return {
    async crear(factura: Factura): Promise<Factura> {
      stmtInsert.run(toRow(factura));
      const row = stmtSelectById.get(factura.id) as FacturaRow | undefined;
      if (!row) {
        throw new Error('crear: factura no fue persistida (estado inesperado)');
      }
      return fromRow(row);
    },
    async buscarPorId(id: string): Promise<Factura | null> {
      const row = stmtSelectById.get(id) as FacturaRow | undefined;
      return row ? fromRow(row) : null;
    },
    async buscarPorPeriodo(idPeriodo: string): Promise<readonly Factura[]> {
      const rows = stmtSelectByPeriodo.all(idPeriodo) as FacturaRow[];
      return rows.map(fromRow);
    },
    async buscarPorSuscriptor(idSuscriptor: number): Promise<readonly Factura[]> {
      const rows = stmtSelectBySuscriptor.all(idSuscriptor) as FacturaRow[];
      return rows.map(fromRow);
    },
    async actualizar(): Promise<Factura> {
      throw new Error('actualizar: pendiente de implementacion');
    },
    async listar(): Promise<readonly Factura[]> {
      const rows = stmtSelectAll.all() as FacturaRow[];
      return rows.map(fromRow);
    },
    cerrar(): void {
      db.close();
    },
  };
}
