/**
 * Adapter expo-sqlite de `PrestadorRepository` para la app movil.
 *
 * Espejo async del adapter Node. Misma interfaz publica que
 * `src/persistencia/sqlite/prestador-repository-sqlite.ts`.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  ActualizarPrestadorInput,
  CrearPrestadorInput,
  FiltrosListarPrestador,
  Prestador,
  PrestadorRepository,
} from '../../../dominio/prestadores';

export interface PrestadorRepositoryExpoSqlite extends PrestadorRepository {
  cerrar(): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

interface PrestadorRow {
  readonly id_prestador: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly nit: string;
  readonly representante_legal: string;
  readonly representante_legal_cedula: string;
  readonly municipio: string;
  readonly departamento: string;
  readonly segmento: number;
  readonly num_suscriptores_urbanos: number;
  readonly num_suscriptores_rurales: number;
  readonly contacto: string | null;
  readonly estado: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly aps: string | null;
}

function fromRow(row: PrestadorRow): Prestador {
  return {
    id_prestador: row.id_prestador,
    codigo: row.codigo,
    nombre: row.nombre,
    nit: row.nit,
    representante_legal: row.representante_legal,
    representante_legal_cedula: row.representante_legal_cedula,
    municipio: row.municipio,
    departamento: row.departamento,
    segmento: row.segmento as Prestador['segmento'],
    num_suscriptores_urbanos: row.num_suscriptores_urbanos,
    num_suscriptores_rurales: row.num_suscriptores_rurales,
    estado: row.estado as Prestador['estado'],
    created_at: row.created_at,
    updated_at: row.updated_at,
    contacto: row.contacto,
    aps: row.aps,
  };
}

export function crearPrestadorRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): PrestadorRepositoryExpoSqlite {
  return {
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      await db.withTransactionAsync(task);
    },

    async crear(data: CrearPrestadorInput): Promise<Prestador> {
      const result = await db.runAsync(
        `INSERT INTO prestador (
          codigo, nombre, nit, representante_legal, representante_legal_cedula,
          municipio, departamento, segmento,
          num_suscriptores_urbanos, num_suscriptores_rurales, contacto, estado, aps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data.codigo, data.nombre, data.nit, data.representante_legal,
        data.representante_legal_cedula, data.municipio, data.departamento, data.segmento,
        data.num_suscriptores_urbanos, data.num_suscriptores_rurales,
        data.contacto ?? null, data.estado ?? 'activo', data.aps ?? null,
      );
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<PrestadorRow>(
        `SELECT * FROM prestador WHERE id_prestador = ?`, id,
      );
      if (!row) throw new Error('crear: prestador no fue persistido');
      return fromRow(row);
    },

    async obtenerPorId(id_prestador: number): Promise<Prestador | null> {
      const row = await db.getFirstAsync<PrestadorRow>(
        `SELECT * FROM prestador WHERE id_prestador = ?`, id_prestador,
      );
      return row ? fromRow(row) : null;
    },

    async existePorCodigo(codigo: string): Promise<boolean> {
      const row = await db.getFirstAsync<{ ok: number }>(
        `SELECT 1 as ok FROM prestador WHERE codigo = ? LIMIT 1`, codigo,
      );
      return row !== null;
    },

    async listar(filtros?: FiltrosListarPrestador): Promise<readonly Prestador[]> {
      const wheres: string[] = [];
      const params: (string | number)[] = [];
      if (filtros?.estado !== undefined) { wheres.push('estado = ?'); params.push(filtros.estado); }
      if (filtros?.segmento !== undefined) { wheres.push('segmento = ?'); params.push(filtros.segmento); }
      if (filtros?.search !== undefined && filtros.search.length > 0) {
        wheres.push('(codigo LIKE ? OR nombre LIKE ? OR municipio LIKE ? OR nit LIKE ?)');
        const s = `%${filtros.search}%`;
        params.push(s, s, s, s);
      }
      const where = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';
      const limit = filtros?.limit ?? 50;
      const offset = ((filtros?.page ?? 1) - 1) * limit;
      const rows = await db.getAllAsync<PrestadorRow>(
        `SELECT * FROM prestador ${where} ORDER BY codigo ASC LIMIT ? OFFSET ?`,
        ...params, limit, offset,
      );
      return rows.map(fromRow);
    },

    async actualizar(id_prestador: number, cambios: ActualizarPrestadorInput): Promise<Prestador> {
      const actual = await db.getFirstAsync<PrestadorRow>(
        `SELECT * FROM prestador WHERE id_prestador = ?`, id_prestador,
      );
      if (!actual) throw new Error('actualizar: prestador no encontrado');
      await db.runAsync(
        `UPDATE prestador
         SET nombre = ?, nit = ?, municipio = ?, departamento = ?, segmento = ?,
             num_suscriptores_urbanos = ?, num_suscriptores_rurales = ?, contacto = ?,
             aps = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now')
         WHERE id_prestador = ?`,
        cambios.nombre ?? actual.nombre,
        cambios.nit ?? actual.nit,
        cambios.municipio ?? actual.municipio,
        cambios.departamento ?? actual.departamento,
        cambios.segmento ?? actual.segmento,
        cambios.num_suscriptores_urbanos ?? actual.num_suscriptores_urbanos,
        cambios.num_suscriptores_rurales ?? actual.num_suscriptores_rurales,
        cambios.contacto ?? actual.contacto,
        cambios.aps !== undefined ? cambios.aps : actual.aps,
        id_prestador,
      );
      const row = await db.getFirstAsync<PrestadorRow>(
        `SELECT * FROM prestador WHERE id_prestador = ?`, id_prestador,
      );
      if (!row) throw new Error('actualizar: prestador no encontrado post-update');
      return fromRow(row);
    },

    async suspender(id_prestador: number): Promise<Prestador> {
      await db.runAsync(
        `UPDATE prestador SET estado = 'suspendido', updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id_prestador = ?`,
        id_prestador,
      );
      const row = await db.getFirstAsync<PrestadorRow>(
        `SELECT * FROM prestador WHERE id_prestador = ?`, id_prestador,
      );
      if (!row) throw new Error('suspender: prestador no encontrado');
      return fromRow(row);
    },

    async reactivar(id_prestador: number): Promise<Prestador> {
      await db.runAsync(
        `UPDATE prestador SET estado = 'activo', updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id_prestador = ?`,
        id_prestador,
      );
      const row = await db.getFirstAsync<PrestadorRow>(
        `SELECT * FROM prestador WHERE id_prestador = ?`, id_prestador,
      );
      if (!row) throw new Error('reactivar: prestador no encontrado');
      return fromRow(row);
    },

    async cerrar(): Promise<void> {
      // La conexion la cierra el bootstrap.ts (db.closeAsync). Este adapter
      // no tiene recursos propios que liberar.
    },

    /**
     * Elimina un prestador por id. Usado por `bootstrapCompleto()` para
     * rollback si una creacion posterior (acuerdo/parametros/operario)
     * falla y queremos dejar la DB limpia.
     *
     * NO se usa en el flujo normal de la app: un prestador real se
     * suspende (`suspender()`) pero no se borra. Solo el wizard de
     * setup inicial lo invoca en la ventana transaccional.
     */
    async eliminar(id_prestador: number): Promise<void> {
      await db.runAsync(`DELETE FROM prestador WHERE id_prestador = ?`, id_prestador);
    },
  };
}
