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
 *  - `componentes_aplicables` se persiste como TEXT (JSON) y se lee
 *    con JSON.parse. Default '[]' (sin componentes activos).
 *  - `minimo_vital` se persiste como JSON serializado del objeto
 *    MinimoVital (o NULL si no hay). El JOIN con la tabla minimo_vital
 *    se hace en una query separada cuando se necesita el shape completo.
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
import type { MinimoVital } from '../../parametros-tarifa/minimo-vital';

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
  readonly ipuf_indice: number;
  readonly cargo_fijo_resultante: number;
  readonly cargo_consumo_resultante: number;
  readonly componentes_aplicables: string;
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
  readonly created_at: string;
  readonly anio_base: number;
  readonly factor_indexacion_ipc: number;
}

interface MinimoVitalRow {
  readonly id_minimo_vital: number;
  readonly id_prestador: number;
  readonly metros_cubicos: number | null;
  readonly estratos_aplica: string;
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
  readonly created_at: string;
}

function parseComponentesAplicables(sql: string): readonly string[] {
  try {
    const parsed = JSON.parse(sql) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    return [];
  } catch {
    return [];
  }
}

function parseMinimoVitalJson(raw: string | null): MinimoVital | null {
  if (raw === null || raw === '') return null;
  try {
    return JSON.parse(raw) as MinimoVital;
  } catch {
    return null;
  }
}

function fromRow(row: ParametrosRow, minimoVital: MinimoVital | null): ParametrosTarifa {
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
    ipuf_indice: row.ipuf_indice,
    cargo_fijo_resultante: row.cargo_fijo_resultante,
    cargo_consumo_resultante: row.cargo_consumo_resultante,
    componentes_aplicables: parseComponentesAplicables(row.componentes_aplicables),
    minimo_vital: minimoVital,
    vigente_desde: row.vigente_desde,
    vigente_hasta: row.vigente_hasta,
    created_at: row.created_at,
    anio_base: row.anio_base,
    factor_indexacion_ipc: row.factor_indexacion_ipc,
  };
}

function fromMinimoVitalRow(row: MinimoVitalRow): MinimoVital {
  let estratos: readonly number[] = [];
  try {
    const parsed = JSON.parse(row.estratos_aplica) as unknown;
    if (Array.isArray(parsed)) {
      estratos = parsed.filter((x): x is number => typeof x === 'number');
    }
  } catch {
    estratos = [];
  }
  return {
    id_minimo_vital: row.id_minimo_vital,
    id_prestador: row.id_prestador,
    metros_cubicos: row.metros_cubicos,
    estratos_aplica: estratos,
    vigente_desde: row.vigente_desde,
    vigente_hasta: row.vigente_hasta,
    created_at: row.created_at,
  };
}

const SQL_INSERT = `
  INSERT INTO parametros_tarifa (
    id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmviaa, aplica_cmviaa,
    agua_suministrada_m3_anio, ipuf_m3_suscriptor_mes, suscriptores_promedio,
    aplica_minimo_vital, m3_gratis_minimo_vital, ipuf_indice,
    cargo_fijo_resultante, cargo_consumo_resultante, componentes_aplicables,
    vigente_desde, vigente_hasta, anio_base, factor_indexacion_ipc
  ) VALUES (
    @id_prestador, @id_acuerdo, @periodo, @cma, @cmo, @cmi, @cmt, @cmviaa, @aplica_cmviaa,
    @agua_suministrada_m3_anio, @ipuf_m3_suscriptor_mes, @suscriptores_promedio,
    @aplica_minimo_vital, @m3_gratis_minimo_vital, @ipuf_indice,
    @cargo_fijo_resultante, @cargo_consumo_resultante, @componentes_aplicables,
    @vigente_desde, @vigente_hasta, @anio_base, @factor_indexacion_ipc
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

const SQL_MINIMO_VITAL_VIGENTE = `
  SELECT * FROM minimo_vital
  WHERE id_prestador = ?
    AND vigente_desde <= ?
    AND vigente_hasta >= ?
  ORDER BY vigente_desde DESC
  LIMIT 1
`;

export function crearParametrosTarifaRepositorySqlite(
  db: DatabaseType,
): ParametrosTarifaRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtBuscarVigente = db.prepare(SQL_BUSCAR_VIGENTE);
  const stmtBuscarPorPeriodo = db.prepare(SQL_BUSCAR_POR_PERIODO);
  const stmtListar = db.prepare(SQL_LISTAR);
  const stmtMinimoVitalVigente = db.prepare(SQL_MINIMO_VITAL_VIGENTE);

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
      ipuf_indice: p.ipuf_indice,
      cargo_fijo_resultante: p.cargo_fijo_resultante,
      cargo_consumo_resultante: p.cargo_consumo_resultante,
      componentes_aplicables: JSON.stringify([...p.componentes_aplicables]),
      vigente_desde: p.vigente_desde,
      vigente_hasta: p.vigente_hasta,
      anio_base: p.anio_base,
      factor_indexacion_ipc: p.factor_indexacion_ipc,
    };
  }

  function loadMinimoVitalVigente(
    id_prestador: number,
    fecha: string,
  ): MinimoVital | null {
    const row = stmtMinimoVitalVigente.get(id_prestador, fecha, fecha) as
      | MinimoVitalRow
      | undefined;
    return row ? fromMinimoVitalRow(row) : null;
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
      // Minimo vital: el modulo ParametrosTarifa no lo embebe, vive
      // en su tabla. Aqui simplemente no hay minimo vital vigente
      // (a menos que la app cree uno en la misma transaccion — fuera
      // de scope de este repo).
      return fromRow(row, null);
    },

    async obtenerPorId(id_parametros: number): Promise<ParametrosTarifa | null> {
      const row = stmtSelectById.get(id_parametros) as ParametrosRow | undefined;
      if (!row) return null;
      // Cargamos el minimo vital vigente del prestador en la fecha
      // actual del sistema (al momento de leer).
      const minimoVital = loadMinimoVitalVigente(
        row.id_prestador,
        new Date().toISOString(),
      );
      return fromRow(row, minimoVital);
    },

    async listar(filtros: FiltrosListarParametros): Promise<readonly ParametrosTarifa[]> {
      const rows = stmtListar.all(filtros.id_prestador) as ParametrosRow[];
      const fecha = new Date().toISOString();
      return rows.map((row) => fromRow(row, loadMinimoVitalVigente(row.id_prestador, fecha)));
    },

    async buscarVigente(id_prestador: number, fecha: string): Promise<ParametrosTarifa | null> {
      const row = stmtBuscarVigente.get(id_prestador, fecha, fecha) as ParametrosRow | undefined;
      if (!row) return null;
      return fromRow(row, loadMinimoVitalVigente(id_prestador, fecha));
    },

    async buscarPorPeriodo(id_prestador: number, periodo: number): Promise<ParametrosTarifa | null> {
      const row = stmtBuscarPorPeriodo.get(id_prestador, periodo) as ParametrosRow | undefined;
      if (!row) return null;
      return fromRow(row, loadMinimoVitalVigente(id_prestador, new Date().toISOString()));
    },

    async eliminar(id: number): Promise<void> {
      db.prepare('DELETE FROM parametros_tarifa WHERE id_parametros = ?').run(id);
    },

    /**
     * Stub de `guardar`. El commit feat(domain) agrega el metodo al
     * interface compartido `ParametrosTarifaRepository`. La
     * implementacion real como UPSERT se hara en un commit posterior
     * (sigue la logica de `crear` + `buscarPorPeriodo` para minimizar
     * diff). Mientras tanto, conserva la firma para que tsc --noEmit
     * pase en el resto del repo.
     */
    async guardar(_data: CrearParametrosTarifaInput): Promise<ParametrosTarifa> {
      throw new Error(
        'guardar: pendiente de implementacion para ParametrosTarifaRepositorySqlite',
      );
    },

    cerrar(): void {
      db.close();
    },
  };
}
