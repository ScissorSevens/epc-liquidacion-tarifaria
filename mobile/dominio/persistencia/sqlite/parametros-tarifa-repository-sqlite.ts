/**
 * Adapter SQLite de `ParametrosTarifaRepository`.
 *
 * Espejo del patrón de los otros repos SQLite. Implementa
 * `buscarVigente(id_prestador, fecha)` y `buscarPorPeriodo(id_prestador, periodo)`.
 *
 * Mapeo ParametrosTarifa <-> row:
 *  - `id_parametros` AUTOINCREMENT.
 *  - `cmviaa` REAL.
 *  - `aplica_cmviaa` y `aplica_minimo_vital` se persisten como INTEGER
 *    (0/1) y se leen como boolean (row.x === 1).
 *
 * El UNIQUE constraint (id_prestador, periodo, vigente_desde) garantiza
 * no duplicar Parametros vigentes para el mismo prestador/periodo.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { mapearErrorSqlite } from './errores';
import type {
  CrearParametrosTarifaInput,
  FiltrosListarParametros,
  ParametrosTarifa,
  ParametrosTarifaRepository,
} from '../../parametros-tarifa';

export interface ParametrosTarifaRepositorySqlite extends ParametrosTarifaRepository {
  cerrar(): void;
}

interface ParametrosRow {
  readonly id_parametros: number;
  readonly id_prestador: number;
  readonly id_acuerdo: number;
  readonly periodo: number;
  readonly cma: number;
  readonly cmo: number;
  readonly cmi: number;
  readonly cmt: number;
  readonly cmviaa: number;
  readonly aplica_cmviaa: number;
  readonly agua_suministrada_m3_anio: number;
  readonly ipuf_m3_suscriptor_mes: number;
  readonly suscriptores_promedio: number;
  readonly aplica_minimo_vital: number;
  readonly m3_gratis_minimo_vital: number;
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
  readonly created_at: string;
}

function fromRow(row: ParametrosRow): ParametrosTarifa {
  return {
    id_parametros: row.id_parametros,
    id_prestador: row.id_prestador,
    id_acuerdo: row.id_acuerdo,
    periodo: row.periodo,
    cma: row.cma,
    cmo: row.cmo,
    cmi: row.cmi,
    cmt: row.cmt,
    cmviaa: row.cmviaa,
    aplica_cmviaa: row.aplica_cmviaa === 1,
    agua_suministrada_m3_anio: row.agua_suministrada_m3_anio,
    ipuf_m3_suscriptor_mes: row.ipuf_m3_suscriptor_mes,
    suscriptores_promedio: row.suscriptores_promedio,
    aplica_minimo_vital: row.aplica_minimo_vital === 1,
    m3_gratis_minimo_vital: row.m3_gratis_minimo_vital,
    vigente_desde: row.vigente_desde,
    vigente_hasta: row.vigente_hasta,
    created_at: row.created_at,
  };
}

const SQL_INSERT = `
  INSERT INTO parametros_tarifa (
    id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmviaa, aplica_cmviaa,
    agua_suministrada_m3_anio, ipuf_m3_suscriptor_mes, suscriptores_promedio,
    aplica_minimo_vital, m3_gratis_minimo_vital, vigente_desde, vigente_hasta
  ) VALUES (
    @id_prestador, @id_acuerdo, @periodo, @cma, @cmo, @cmi, @cmt, @cmviaa, @aplica_cmviaa,
    @agua_suministrada_m3_anio, @ipuf_m3_suscriptor_mes, @suscriptores_promedio,
    @aplica_minimo_vital, @m3_gratis_minimo_vital, @vigente_desde, @vigente_hasta
  )
`;

const SQL_SELECT_BY_ID = `SELECT * FROM parametros_tarifa WHERE id_parametros = ?`;

const SQL_BUSCAR_VIGENTE = `
  SELECT * FROM parametros_tarifa
  WHERE id_prestador = ?
    AND vigente_desde <= ?
    AND vigente_hasta >= ?
  ORDER BY vigente_desde DESC
  LIMIT 1
`;

const SQL_BUSCAR_POR_PERIODO = `
  SELECT * FROM parametros_tarifa
  WHERE id_prestador = ? AND periodo = ?
  ORDER BY vigente_desde DESC
  LIMIT 1
`;

const SQL_LISTAR = `
  SELECT * FROM parametros_tarifa
  WHERE id_prestador = ?
  ORDER BY periodo DESC, vigente_desde DESC
`;

export function crearParametrosTarifaRepositorySqlite(
  db: DatabaseType,
): ParametrosTarifaRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtBuscarVigente = db.prepare(SQL_BUSCAR_VIGENTE);
  const stmtBuscarPorPeriodo = db.prepare(SQL_BUSCAR_POR_PERIODO);
  const stmtListar = db.prepare(SQL_LISTAR);

  function toInsertParams(p: CrearParametrosTarifaInput): Record<string, unknown> {
    return {
      id_prestador: p.id_prestador,
      id_acuerdo: p.id_acuerdo,
      periodo: p.periodo,
      cma: p.cma,
      cmo: p.cmo,
      cmi: p.cmi,
      cmt: p.cmt,
      cmviaa: p.cmviaa,
      aplica_cmviaa: p.aplica_cmviaa ? 1 : 0,
      agua_suministrada_m3_anio: p.agua_suministrada_m3_anio,
      ipuf_m3_suscriptor_mes: p.ipuf_m3_suscriptor_mes,
      suscriptores_promedio: p.suscriptores_promedio,
      aplica_minimo_vital: p.aplica_minimo_vital ? 1 : 0,
      m3_gratis_minimo_vital: p.m3_gratis_minimo_vital,
      vigente_desde: p.vigente_desde,
      vigente_hasta: p.vigente_hasta,
    };
  }

  return {
    async crear(data: CrearParametrosTarifaInput): Promise<ParametrosTarifa> {
      let info;
      try {
        info = stmtInsert.run(toInsertParams(data));
      } catch (e) {
        throw mapearErrorSqlite(e, { tabla: 'parametros_tarifa' });
      }
      const id = Number(info.lastInsertRowid);
      const row = stmtSelectById.get(id) as ParametrosRow | undefined;
      if (!row) {
        throw new Error('crear: parametros no fueron persistidos');
      }
      return fromRow(row);
    },

    async obtenerPorId(id_parametros: number): Promise<ParametrosTarifa | null> {
      const row = stmtSelectById.get(id_parametros) as ParametrosRow | undefined;
      return row ? fromRow(row) : null;
    },

    async listar(filtros: FiltrosListarParametros): Promise<readonly ParametrosTarifa[]> {
      const rows = stmtListar.all(filtros.id_prestador) as ParametrosRow[];
      return rows.map(fromRow);
    },

    async buscarVigente(id_prestador: number, fecha: string): Promise<ParametrosTarifa | null> {
      const row = stmtBuscarVigente.get(id_prestador, fecha, fecha) as ParametrosRow | undefined;
      return row ? fromRow(row) : null;
    },

    async buscarPorPeriodo(id_prestador: number, periodo: number): Promise<ParametrosTarifa | null> {
      const row = stmtBuscarPorPeriodo.get(id_prestador, periodo) as ParametrosRow | undefined;
      return row ? fromRow(row) : null;
    },

    async eliminar(id: number): Promise<void> {
      db.prepare('DELETE FROM parametros_tarifa WHERE id_parametros = ?').run(id);
    },

    cerrar(): void {
      db.close();
    },
  };
}
