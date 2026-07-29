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
import { esTransicionLegal } from './factura';
import { mapearErrorSqlite } from '../persistencia/sqlite/errores';
import {
  MENSAJES_ERROR_FACTURA,
  type EstadoFactura,
  type Factura,
  type FacturaRepository,
  type FacturaSnapshot,
} from './types';

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
  // Compatibilidad: filas v1 (pre-migration 020) no tienen codigo_verificacion
  // y version_tarifa_aplicada en columnas. Como estan en el snapshot JSON,
  // los extraemos de alli con fallback a los campos top-level.
  const codigoVerificacion = calcularCodigoVerificacionPlaceholder(row.hash);
  const versionTarifaAplicada =
    snapshot.liquidacion.resultado.metadata.version_motor ?? 'v1-legacy';
  const referenciaPago: string | undefined = undefined; // columna migration 020
  const qrPago: string | undefined = undefined; // columna migration 020
  const factura: Factura = {
    id: row.id,
    numero_factura: row.numero_factura,
    estado: row.estado as Factura['estado'],
    fecha_emision: row.fecha_emision,
    snapshot,
    hash: row.hash,
    codigo_verificacion: codigoVerificacion,
    version_tarifa_aplicada: versionTarifaAplicada,
    ...(referenciaPago !== undefined && { referencia_pago: referenciaPago }),
    ...(qrPago !== undefined && { qr_pago: qrPago }),
    created_at: row.created_at,
    ...(row.motivo_anulacion !== null && { motivo_anulacion: row.motivo_anulacion }),
    ...(row.fecha_anulacion !== null && { fecha_anulacion: row.fecha_anulacion }),
    ...(row.reemplaza_a !== null && { reemplaza_a: row.reemplaza_a }),
  };
  return factura;
}

function calcularCodigoVerificacionPlaceholder(hash: string): string {
  // Espejo del helper en pagos.ts: filtra chars no-hex (compat con
  // hasher fake en tests), convierte primeros 16 hex chars a base36,
  // padStart a 10. En prod el hash es SHA-256 hex de 64 chars.
  const hexOnly = (hash + '0'.repeat(16))
    .split('')
    .filter((ch) => /[0-9a-fA-F]/.test(ch))
    .join('')
    .slice(0, 16)
    .padEnd(16, '0');
  const valor = parseInt(hexOnly, 16);
  const base36 = valor.toString(36).toUpperCase();
  return base36.slice(0, 10).padStart(10, '0');
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
const SQL_UPDATE = `
  UPDATE factura SET
    estado = @estado,
    motivo_anulacion = @motivo_anulacion,
    fecha_anulacion = @fecha_anulacion
  WHERE id = @id
`;

function lanzarTransicionIlegal(actual: EstadoFactura, intentada: EstadoFactura): never {
  const err = new Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL);
  (err as Error & { cause: unknown }).cause = {
    codigo: 'TRANSICION_ILEGAL',
    actual,
    intentada,
  };
  throw err;
}

/**
 * Traduce errores SQLite del adapter a errores de dominio.
 *
 * El mapper de infra (`mapearErrorSqlite`) habla CODIGOS. El adapter es
 * quien conoce el catalogo `MENSAJES_ERROR_FACTURA` y construye el Error
 * con cause estructurada que el orquestador `*ConRepo` puede inspeccionar.
 *
 * - `RESTRICCION_UNICIDAD` → mensaje generico de unicidad. La traduccion
 *   especifica a `LIQUIDACION_YA_FACTURADA` la hace el orquestador
 *   (cierre hexagonal Pre-Batch 4.7-bis Opcion A).
 * - `TRANSICION_ILEGAL` (CHECK SQL en factura.estado) → defense-in-depth.
 *   Si el guard de codigo se escapa, el CHECK SQL rebota y mapeamos al
 *   mismo mensaje de dominio.
 */
function traducirErrorAdapter(err: unknown, ctx: { liquidacion_id?: string }): Error {
  const mapeado = mapearErrorSqlite(err, { tabla: 'factura' });
  const codigo = mapeado.cause.codigo;
  if (codigo === 'RESTRICCION_UNICIDAD') {
    const e = new Error(MENSAJES_ERROR_FACTURA.RESTRICCION_UNICIDAD);
    (e as Error & { cause: unknown }).cause = {
      codigo: 'RESTRICCION_UNICIDAD',
      ctx: { liquidacion_id: ctx.liquidacion_id },
    };
    return e;
  }
  if (codigo === 'TRANSICION_ILEGAL') {
    const e = new Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL);
    (e as Error & { cause: unknown }).cause = { codigo: 'TRANSICION_ILEGAL' };
    return e;
  }
  return mapeado;
}

export function crearFacturaRepositorySqlite(db: DatabaseType): FacturaRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtSelectByPeriodo = db.prepare(SQL_SELECT_BY_PERIODO);
  const stmtSelectBySuscriptor = db.prepare(SQL_SELECT_BY_SUSCRIPTOR);
  const stmtSelectAll = db.prepare(SQL_SELECT_ALL);
  const stmtUpdate = db.prepare(SQL_UPDATE);

  return {
    async crear(factura: Factura): Promise<Factura> {
      try {
        stmtInsert.run(toRow(factura));
      } catch (e) {
        throw traducirErrorAdapter(e, {
          liquidacion_id: factura.snapshot.liquidacion.id,
        });
      }
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
    async actualizar(id, cambios): Promise<Factura> {
      const existenteRow = stmtSelectById.get(id) as FacturaRow | undefined;
      if (!existenteRow) {
        throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
      }
      const existente = fromRow(existenteRow);
      // Defense-in-depth a nivel codigo (W2): validar transicion ANTES de
      // tocar SQLite. Solo cuando el estado efectivamente cambia.
      if (cambios.estado !== existente.estado) {
        if (!esTransicionLegal(existente.estado, cambios.estado)) {
          lanzarTransicionIlegal(existente.estado, cambios.estado);
        }
      }
      const motivo = cambios.motivo_anulacion ?? existente.motivo_anulacion ?? null;
      const fecha = cambios.fecha_anulacion ?? existente.fecha_anulacion ?? null;
      try {
        stmtUpdate.run({
          id,
          estado: cambios.estado,
          motivo_anulacion: motivo,
          fecha_anulacion: fecha,
        });
      } catch (e) {
        throw traducirErrorAdapter(e, {
          liquidacion_id: existente.snapshot.liquidacion.id,
        });
      }
      const row = stmtSelectById.get(id) as FacturaRow | undefined;
      if (!row) {
        throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
      }
      return fromRow(row);
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
