/**
 * Adapter SQLite de `AcuerdoMunicipalRepository`.
 *
 * Espejo del patrón de `prestador-repository-sqlite.ts`. Implementa
 * `buscarVigente(id_prestador, fecha)` para que el bootstrap y la UI
 * puedan resolver el Acuerdo aplicable a una fecha concreta.
 *
 * Mapeo AcuerdoMunicipal <-> row:
 *  - `id_acuerdo` AUTOINCREMENT.
 *  - `factor_*` se persisten como REAL; al leer se devuelven number.
 *  - `acto_administrativo_url` y `observaciones` se persisten como
 *    NULL si vienen null; al leer se OMITE del objeto si NULL.
 *
 * Reglas de validación (Q6 spec + L142/1994 art. 99.6):
 *  - factor_subsidio_e1 ∈ [-1.0, 0]  (CHECK en SQL: <= 0)
 *  - factor_subsidio_e2 ∈ [-1.0, 0]
 *  - factor_subsidio_e3 ∈ [-1.0, 0]
 *  - factor_contribucion_e5 ∈ [0, +0.50]  (no acotado en SQL; el motor CAPEA)
 *  - factor_contribucion_e6 ∈ [0, +0.60]
 *  - factor_contribucion_comercial >= 0  (SQL CHECK)
 *  - factor_contribucion_industrial >= 0  (SQL CHECK)
 *
 * NOTA: los topes legales L142/1994 los aplica el MOTOR en
 * `caparFactorEstrato`, no el schema. Esto permite al prestador
 * declarar factores fuera de rango y que el motor registre violación
 * legal sin romper el INSERT.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { mapearErrorSqlite } from './errores';
import type {
  AcuerdoMunicipal,
  AcuerdoMunicipalRepository,
  CrearAcuerdoMunicipalInput,
  FiltrosListarAcuerdos,
} from '../../acuerdo-municipal';

export interface AcuerdoMunicipalRepositorySqlite extends AcuerdoMunicipalRepository {
  cerrar(): void;
}

interface AcuerdoRow {
  readonly id_acuerdo: number;
  readonly id_prestador: number;
  readonly factor_subsidio_e1: number;
  readonly factor_subsidio_e2: number;
  readonly factor_subsidio_e3: number;
  readonly factor_contribucion_e5: number;
  readonly factor_contribucion_e6: number;
  readonly factor_contribucion_comercial: number;
  readonly factor_contribucion_industrial: number;
  readonly fecha_vigencia_desde: string;
  readonly fecha_vigencia_hasta: string;
  readonly acto_administrativo_url: string | null;
  readonly observaciones: string | null;
  readonly created_at: string;
}

function fromRow(row: AcuerdoRow): AcuerdoMunicipal {
  return {
    id_acuerdo: row.id_acuerdo,
    id_prestador: row.id_prestador,
    factor_subsidio_e1: row.factor_subsidio_e1,
    factor_subsidio_e2: row.factor_subsidio_e2,
    factor_subsidio_e3: row.factor_subsidio_e3,
    factor_contribucion_e5: row.factor_contribucion_e5,
    factor_contribucion_e6: row.factor_contribucion_e6,
    factor_contribucion_comercial: row.factor_contribucion_comercial,
    factor_contribucion_industrial: row.factor_contribucion_industrial,
    fecha_vigencia_desde: row.fecha_vigencia_desde,
    fecha_vigencia_hasta: row.fecha_vigencia_hasta,
    acto_administrativo_url: row.acto_administrativo_url,
    observaciones: row.observaciones,
    created_at: row.created_at,
    // ...(row.acto_administrativo_url !== null && { acto_administrativo_url: row.acto_administrativo_url }),
    // ...(row.observaciones !== null && { observaciones: row.observaciones }),
  };
}

const SQL_INSERT = `
  INSERT INTO acuerdo_municipal (
    id_prestador, factor_subsidio_e1, factor_subsidio_e2, factor_subsidio_e3,
    factor_contribucion_e5, factor_contribucion_e6,
    factor_contribucion_comercial, factor_contribucion_industrial,
    fecha_vigencia_desde, fecha_vigencia_hasta,
    acto_administrativo_url, observaciones
  ) VALUES (
    @id_prestador, @factor_subsidio_e1, @factor_subsidio_e2, @factor_subsidio_e3,
    @factor_contribucion_e5, @factor_contribucion_e6,
    @factor_contribucion_comercial, @factor_contribucion_industrial,
    @fecha_vigencia_desde, @fecha_vigencia_hasta,
    @acto_administrativo_url, @observaciones
  )
`;

const SQL_SELECT_BY_ID = `SELECT * FROM acuerdo_municipal WHERE id_acuerdo = ?`;

/**
 * Busca el Acuerdo vigente del prestador en la fecha dada.
 * Lógica: fecha_vigencia_desde <= fecha <= fecha_vigencia_hasta.
 */
const SQL_BUSCAR_VIGENTE = `
  SELECT * FROM acuerdo_municipal
  WHERE id_prestador = ?
    AND fecha_vigencia_desde <= ?
    AND fecha_vigencia_hasta >= ?
  ORDER BY fecha_vigencia_desde DESC
  LIMIT 1
`;

const SQL_LISTAR_POR_PRESTADOR = `
  SELECT * FROM acuerdo_municipal
  WHERE id_prestador = ?
  ORDER BY fecha_vigencia_desde DESC
`;

export function crearAcuerdoMunicipalRepositorySqlite(
  db: DatabaseType,
): AcuerdoMunicipalRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtBuscarVigente = db.prepare(SQL_BUSCAR_VIGENTE);
  const stmtListarPorPrestador = db.prepare(SQL_LISTAR_POR_PRESTADOR);

  function toInsertParams(a: CrearAcuerdoMunicipalInput): Record<string, unknown> {
    return {
      id_prestador: a.id_prestador,
      factor_subsidio_e1: a.factor_subsidio_e1,
      factor_subsidio_e2: a.factor_subsidio_e2,
      factor_subsidio_e3: a.factor_subsidio_e3,
      factor_contribucion_e5: a.factor_contribucion_e5,
      factor_contribucion_e6: a.factor_contribucion_e6,
      factor_contribucion_comercial: a.factor_contribucion_comercial,
      factor_contribucion_industrial: a.factor_contribucion_industrial,
      fecha_vigencia_desde: a.fecha_vigencia_desde,
      fecha_vigencia_hasta: a.fecha_vigencia_hasta,
      acto_administrativo_url: a.acto_administrativo_url,
      observaciones: a.observaciones,
    };
  }

  return {
    async crear(data: CrearAcuerdoMunicipalInput): Promise<AcuerdoMunicipal> {
      let info;
      try {
        info = stmtInsert.run(toInsertParams(data));
      } catch (e) {
        throw mapearErrorSqlite(e, { tabla: 'acuerdo_municipal' });
      }
      const id = Number(info.lastInsertRowid);
      const row = stmtSelectById.get(id) as AcuerdoRow | undefined;
      if (!row) {
        throw new Error('crear: acuerdo no fue persistido');
      }
      return fromRow(row);
    },

    async obtenerPorId(id_acuerdo: number): Promise<AcuerdoMunicipal | null> {
      const row = stmtSelectById.get(id_acuerdo) as AcuerdoRow | undefined;
      return row ? fromRow(row) : null;
    },

    async listar(filtros: FiltrosListarAcuerdos): Promise<readonly AcuerdoMunicipal[]> {
      const rows = stmtListarPorPrestador.all(filtros.id_prestador) as AcuerdoRow[];
      return rows.map(fromRow);
    },

    async buscarVigente(id_prestador: number, fecha: string): Promise<AcuerdoMunicipal | null> {
      const row = stmtBuscarVigente.get(id_prestador, fecha, fecha) as AcuerdoRow | undefined;
      return row ? fromRow(row) : null;
    },

    cerrar(): void {
      db.close();
    },
  };
}
