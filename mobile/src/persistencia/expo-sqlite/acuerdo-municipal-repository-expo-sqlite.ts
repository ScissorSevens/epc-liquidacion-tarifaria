/**
 * Adapter expo-sqlite de `AcuerdoMunicipalRepository` para la app movil.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  AcuerdoMunicipal,
  AcuerdoMunicipalRepository,
  CrearAcuerdoMunicipalInput,
  FiltrosListarAcuerdos,
} from '@dominio/acuerdo-municipal';

export interface AcuerdoMunicipalRepositoryExpoSqlite extends AcuerdoMunicipalRepository {
  cerrar(): Promise<void>;
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
  };
}

export function crearAcuerdoMunicipalRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): AcuerdoMunicipalRepositoryExpoSqlite {
  return {
    async crear(data: CrearAcuerdoMunicipalInput): Promise<AcuerdoMunicipal> {
      const result = await db.runAsync(
        `INSERT INTO acuerdo_municipal (
          id_prestador, factor_subsidio_e1, factor_subsidio_e2, factor_subsidio_e3,
          factor_contribucion_e5, factor_contribucion_e6,
          factor_contribucion_comercial, factor_contribucion_industrial,
          fecha_vigencia_desde, fecha_vigencia_hasta,
          acto_administrativo_url, observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data.id_prestador, data.factor_subsidio_e1, data.factor_subsidio_e2, data.factor_subsidio_e3,
        data.factor_contribucion_e5, data.factor_contribucion_e6,
        data.factor_contribucion_comercial, data.factor_contribucion_industrial,
        data.fecha_vigencia_desde, data.fecha_vigencia_hasta,
        data.acto_administrativo_url, data.observaciones,
      );
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<AcuerdoRow>(
        `SELECT * FROM acuerdo_municipal WHERE id_acuerdo = ?`, id,
      );
      if (!row) throw new Error('crear: acuerdo no fue persistido');
      return fromRow(row);
    },

    async obtenerPorId(id_acuerdo: number): Promise<AcuerdoMunicipal | null> {
      const row = await db.getFirstAsync<AcuerdoRow>(
        `SELECT * FROM acuerdo_municipal WHERE id_acuerdo = ?`, id_acuerdo,
      );
      return row ? fromRow(row) : null;
    },

    async listar(filtros: FiltrosListarAcuerdos): Promise<readonly AcuerdoMunicipal[]> {
      const rows = await db.getAllAsync<AcuerdoRow>(
        `SELECT * FROM acuerdo_municipal WHERE id_prestador = ? ORDER BY fecha_vigencia_desde DESC`,
        filtros.id_prestador,
      );
      return rows.map(fromRow);
    },

    async buscarVigente(id_prestador: number, fecha: string): Promise<AcuerdoMunicipal | null> {
      const row = await db.getFirstAsync<AcuerdoRow>(
        `SELECT * FROM acuerdo_municipal
         WHERE id_prestador = ?
           AND fecha_vigencia_desde <= ?
           AND fecha_vigencia_hasta >= ?
         ORDER BY fecha_vigencia_desde DESC
         LIMIT 1`,
        id_prestador, fecha, fecha,
      );
      return row ? fromRow(row) : null;
    },

    async cerrar(): Promise<void> {
      // Conexion la cierra el bootstrap.
    },
  };
}
