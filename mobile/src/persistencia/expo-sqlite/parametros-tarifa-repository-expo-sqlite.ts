/**
 * Adapter expo-sqlite de `ParametrosTarifaRepository` para la app movil.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  CrearParametrosTarifaInput,
  FiltrosListarParametros,
  ParametrosTarifa,
  ParametrosTarifaRepository,
} from '../../../dominio/parametros-tarifa';
import type { MinimoVital } from '../../../dominio/parametros-tarifa/minimo-vital';

export interface ParametrosTarifaRepositoryExpoSqlite extends ParametrosTarifaRepository {
  cerrar(): Promise<void>;
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
  };
}

export function crearParametrosTarifaRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): ParametrosTarifaRepositoryExpoSqlite {
  async function loadMinimoVitalVigente(
    id_prestador: number,
    fecha: string,
  ): Promise<MinimoVital | null> {
    const row = await db.getFirstAsync<MinimoVitalRow>(
      `SELECT * FROM minimo_vital
       WHERE id_prestador = ?
         AND vigente_desde <= ?
         AND vigente_hasta >= ?
       ORDER BY vigente_desde DESC
       LIMIT 1`,
      id_prestador, fecha, fecha,
    );
    return row ? fromMinimoVitalRow(row) : null;
  }

  return {
    async crear(data: CrearParametrosTarifaInput): Promise<ParametrosTarifa> {
      const result = await db.runAsync(
        `INSERT INTO parametros_tarifa (
          id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmviaa, aplica_cmviaa,
          agua_suministrada_m3_anio, ipuf_m3_suscriptor_mes, suscriptores_promedio,
          aplica_minimo_vital, m3_gratis_minimo_vital, ipuf_indice,
          cargo_fijo_resultante, cargo_consumo_resultante, componentes_aplicables,
          vigente_desde, vigente_hasta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data.id_prestador, data.id_acuerdo, data.periodo, data.cma, data.cmo, data.cmi, data.cmt,
        data.cmviaa, data.aplica_cmviaa ? 1 : 0,
        data.agua_suministrada_m3_anio, data.ipuf_m3_suscriptor_mes, data.suscriptores_promedio,
        data.aplica_minimo_vital ? 1 : 0, data.m3_gratis_minimo_vital,
        data.ipuf_indice, data.cargo_fijo_resultante, data.cargo_consumo_resultante,
        JSON.stringify([...data.componentes_aplicables]),
        data.vigente_desde, data.vigente_hasta,
      );
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_parametros = ?`, id,
      );
      if (!row) throw new Error('crear: parametros no fueron persistidos');
      return fromRow(row, null);
    },

    async obtenerPorId(id_parametros: number): Promise<ParametrosTarifa | null> {
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_parametros = ?`, id_parametros,
      );
      if (!row) return null;
      const minimoVital = await loadMinimoVitalVigente(
        row.id_prestador,
        new Date().toISOString(),
      );
      return fromRow(row, minimoVital);
    },

    async listar(filtros: FiltrosListarParametros): Promise<readonly ParametrosTarifa[]> {
      const rows = await db.getAllAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_prestador = ? ORDER BY periodo DESC, vigente_desde DESC`,
        filtros.id_prestador,
      );
      const fecha = new Date().toISOString();
      const out: ParametrosTarifa[] = [];
      for (const row of rows) {
        const minimoVital = await loadMinimoVitalVigente(row.id_prestador, fecha);
        out.push(fromRow(row, minimoVital));
      }
      return out;
    },

    async buscarVigente(id_prestador: number, fecha: string): Promise<ParametrosTarifa | null> {
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa
         WHERE id_prestador = ?
           AND vigente_desde <= ?
           AND vigente_hasta >= ?
         ORDER BY vigente_desde DESC
         LIMIT 1`,
        id_prestador, fecha, fecha,
      );
      if (!row) return null;
      const minimoVital = await loadMinimoVitalVigente(id_prestador, fecha);
      return fromRow(row, minimoVital);
    },

    async buscarPorPeriodo(id_prestador: number, periodo: number): Promise<ParametrosTarifa | null> {
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_prestador = ? AND periodo = ? ORDER BY vigente_desde DESC LIMIT 1`,
        id_prestador, periodo,
      );
      if (!row) return null;
      const minimoVital = await loadMinimoVitalVigente(
        row.id_prestador,
        new Date().toISOString(),
      );
      return fromRow(row, minimoVital);
    },

    async cerrar(): Promise<void> {
      // Conexion la cierra el bootstrap.
    },

    /**
     * Elimina parametros de tarifa por id. Usado por `bootstrapCompleto()`
     * para rollback si la creacion del operario falla y queremos dejar
     * la DB limpia.
     */
    async eliminar(id_parametros: number): Promise<void> {
      await db.runAsync(`DELETE FROM parametros_tarifa WHERE id_parametros = ?`, id_parametros);
    },

    /**
     * UPSERT por la triple clave (id_prestador, periodo, vigente_desde).
     *
     * Por que UPSERT (no `crear`):
     *   El UNIQUE constraint `UNIQUE(id_prestador, periodo, vigente_desde)`
     *   garantiza no duplicar Parametros vigentes. El UPSERT convierte
     *   eso en una primitiva declarativa: si la fila existe, UPDATE; si
     *   no, INSERT. Esto matchea exactamente el flujo de la pantalla
     *   admin `ParametrosTarifa.tsx`:
     *     1) `buscarVigente` para pre-rellenar el form.
     *     2) `guardar` con todo el payload (sea alta nueva o edicion).
     *
     * El id_parametros NO cambia cuando hay match (mismo registro). Se
     * preserva `created_at` original (no esta en el SET). Despues del
     * UPSERT hacemos un SELECT por la triple clave para devolver el row
     * completo mapeado via `fromRow`.
     *
     * Decisiones:
     *   - `excluded.<col>` en el DO UPDATE SET evita ambiguedad entre el
     *     valor pre-existente y el nuevo (sqlite docs: `excluded` es el
     *     pseudo-row del INSERT que se intento).
     *   - `id_parametros` y `created_at` NO estan en el SET: la primera
     *     es PK autogenerada, la segunda la asigna SQLite con `strftime`
     *     al INSERT inicial y solo se preserva.
     *   - SELECT post-UPSERT va por la triple clave (no por
     *     `id_parametros`) porque el UPSERT puede haber UPDATEADO una fila
     *     existente — `lastInsertRowId` en ese caso devuelve el id del
     *     registro actualizado, no uno nuevo, pero queremos asegurar el
     *     contrato "dame la fila persistida por la triple clave".
     */
    async guardar(data: CrearParametrosTarifaInput): Promise<ParametrosTarifa> {
      await db.runAsync(
        `INSERT INTO parametros_tarifa (
          id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmviaa, aplica_cmviaa,
          agua_suministrada_m3_anio, ipuf_m3_suscriptor_mes, suscriptores_promedio,
          aplica_minimo_vital, m3_gratis_minimo_vital, ipuf_indice,
          cargo_fijo_resultante, cargo_consumo_resultante, componentes_aplicables,
          vigente_desde, vigente_hasta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_prestador, periodo, vigente_desde) DO UPDATE SET
          id_acuerdo = excluded.id_acuerdo,
          cma = excluded.cma,
          cmo = excluded.cmo,
          cmi = excluded.cmi,
          cmt = excluded.cmt,
          cmviaa = excluded.cmviaa,
          aplica_cmviaa = excluded.aplica_cmviaa,
          agua_suministrada_m3_anio = excluded.agua_suministrada_m3_anio,
          ipuf_m3_suscriptor_mes = excluded.ipuf_m3_suscriptor_mes,
          suscriptores_promedio = excluded.suscriptores_promedio,
          aplica_minimo_vital = excluded.aplica_minimo_vital,
          m3_gratis_minimo_vital = excluded.m3_gratis_minimo_vital,
          ipuf_indice = excluded.ipuf_indice,
          cargo_fijo_resultante = excluded.cargo_fijo_resultante,
          cargo_consumo_resultante = excluded.cargo_consumo_resultante,
          componentes_aplicables = excluded.componentes_aplicables,
          vigente_hasta = excluded.vigente_hasta`,
        data.id_prestador, data.id_acuerdo, data.periodo, data.cma, data.cmo, data.cmi, data.cmt,
        data.cmviaa, data.aplica_cmviaa ? 1 : 0,
        data.agua_suministrada_m3_anio, data.ipuf_m3_suscriptor_mes, data.suscriptores_promedio,
        data.aplica_minimo_vital ? 1 : 0, data.m3_gratis_minimo_vital,
        data.ipuf_indice, data.cargo_fijo_resultante, data.cargo_consumo_resultante,
        JSON.stringify([...data.componentes_aplicables]),
        data.vigente_desde, data.vigente_hasta,
      );
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa
         WHERE id_prestador = ? AND periodo = ? AND vigente_desde = ?`,
        data.id_prestador, data.periodo, data.vigente_desde,
      );
      if (!row) throw new Error('guardar: parametros no fueron persistidos');
      return fromRow(row, null);
    },
  };
}
