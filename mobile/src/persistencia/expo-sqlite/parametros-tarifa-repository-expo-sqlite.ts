/**
 * Adapter expo-sqlite de `ParametrosTarifaRepository` para la app movil.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  CrearParametrosTarifaInput,
  FiltrosListarParametros,
  ParametrosTarifa,
  ParametrosTarifaRepository,
} from '@dominio/parametros-tarifa';

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

export function crearParametrosTarifaRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): ParametrosTarifaRepositoryExpoSqlite {
  return {
    async crear(data: CrearParametrosTarifaInput): Promise<ParametrosTarifa> {
      const result = await db.runAsync(
        `INSERT INTO parametros_tarifa (
          id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmviaa, aplica_cmviaa,
          agua_suministrada_m3_anio, ipuf_m3_suscriptor_mes, suscriptores_promedio,
          aplica_minimo_vital, m3_gratis_minimo_vital, vigente_desde, vigente_hasta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data.id_prestador, data.id_acuerdo, data.periodo, data.cma, data.cmo, data.cmi, data.cmt,
        data.cmviaa, data.aplica_cmviaa ? 1 : 0,
        data.agua_suministrada_m3_anio, data.ipuf_m3_suscriptor_mes, data.suscriptores_promedio,
        data.aplica_minimo_vital ? 1 : 0, data.m3_gratis_minimo_vital,
        data.vigente_desde, data.vigente_hasta,
      );
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_parametros = ?`, id,
      );
      if (!row) throw new Error('crear: parametros no fueron persistidos');
      return fromRow(row);
    },

    async obtenerPorId(id_parametros: number): Promise<ParametrosTarifa | null> {
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_parametros = ?`, id_parametros,
      );
      return row ? fromRow(row) : null;
    },

    async listar(filtros: FiltrosListarParametros): Promise<readonly ParametrosTarifa[]> {
      const rows = await db.getAllAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_prestador = ? ORDER BY periodo DESC, vigente_desde DESC`,
        filtros.id_prestador,
      );
      return rows.map(fromRow);
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
      return row ? fromRow(row) : null;
    },

    async buscarPorPeriodo(id_prestador: number, periodo: number): Promise<ParametrosTarifa | null> {
      const row = await db.getFirstAsync<ParametrosRow>(
        `SELECT * FROM parametros_tarifa WHERE id_prestador = ? AND periodo = ? ORDER BY vigente_desde DESC LIMIT 1`,
        id_prestador, periodo,
      );
      return row ? fromRow(row) : null;
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
  };
}
