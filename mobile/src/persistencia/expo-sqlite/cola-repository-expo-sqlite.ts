/**
 * Adapter expo-sqlite de `ColaSincronizacion` para la app movil.
 *
 * Espejo async de `src/persistencia/sqlite/cola-repository-sqlite.ts`
 * (Node / better-sqlite3). Misma interfaz publica con los metodos ya
 * `Promise<>` (la cola es async desde el primer dia).
 *
 * Mapeo ItemCola <-> row identico al adapter Node:
 *  - `payload` y `dependeDe` como TEXT JSON.
 *  - `creadoEn` / `ultimoIntentoEn` como TEXT ISO 8601.
 *  - `forzarSobrescribir` como INTEGER 0/1 nullable.
 *  - Opcionales ausentes se omiten al leer (no `null` ni `undefined`
 *    explicito en el objeto).
 *
 * Semantica: UPSERT por id (mismo `INSERT ... ON CONFLICT DO UPDATE`).
 *
 * Resuelve la BOMBA OFFLINE-FIRST #1 en el celular: la cola sobrevive
 * cierres de la app mobile.
 */

import type * as SQLite from 'expo-sqlite';
import type { ColaSincronizacion } from '@dominio/sincronizacion/cola-repository';
import type { EstadoItem, ItemCola, TipoItem } from '@dominio/sincronizacion/types';

interface ColaRow {
  readonly id: string;
  readonly tipo: string;
  readonly payload: string;
  readonly hash_local: string;
  readonly hash_server: string | null;
  readonly estado: string;
  readonly intentos: number;
  readonly ultimo_error: string | null;
  readonly ultimo_intento_en: string | null;
  readonly creado_en: string;
  readonly depende_de: string | null;
  readonly forzar_sobrescribir: number | null;
}

function fromRow(row: ColaRow): ItemCola {
  const item: ItemCola = {
    id: row.id,
    tipo: row.tipo as TipoItem,
    payload: JSON.parse(row.payload) as unknown,
    hashLocal: row.hash_local,
    estado: row.estado as EstadoItem,
    intentos: row.intentos,
    ultimoError: row.ultimo_error,
    ultimoIntentoEn:
      row.ultimo_intento_en !== null ? new Date(row.ultimo_intento_en) : null,
    creadoEn: new Date(row.creado_en),
    ...(row.hash_server !== null && { hashServer: row.hash_server }),
    ...(row.depende_de !== null && {
      dependeDe: JSON.parse(row.depende_de) as string[],
    }),
    ...(row.forzar_sobrescribir !== null && {
      forzarSobrescribir: row.forzar_sobrescribir === 1,
    }),
  };
  return item;
}

const SQL_UPSERT = `
  INSERT INTO cola_sincronizacion (
    id, tipo, payload, hash_local, hash_server, estado, intentos, ultimo_error,
    ultimo_intento_en, creado_en, depende_de, forzar_sobrescribir
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    tipo = excluded.tipo,
    payload = excluded.payload,
    hash_local = excluded.hash_local,
    hash_server = excluded.hash_server,
    estado = excluded.estado,
    intentos = excluded.intentos,
    ultimo_error = excluded.ultimo_error,
    ultimo_intento_en = excluded.ultimo_intento_en,
    creado_en = excluded.creado_en,
    depende_de = excluded.depende_de,
    forzar_sobrescribir = excluded.forzar_sobrescribir
`;

const SQL_SELECT_ALL = `SELECT * FROM cola_sincronizacion`;
const SQL_SELECT_PENDIENTES = `SELECT * FROM cola_sincronizacion WHERE estado = 'PENDIENTE'`;
const SQL_SELECT_BY_ID = `SELECT * FROM cola_sincronizacion WHERE id = ?`;
const SQL_DELETE_BY_ID = `DELETE FROM cola_sincronizacion WHERE id = ?`;

export interface ColaRepositoryExpoSqlite extends ColaSincronizacion {
  cerrar(): Promise<void>;
  /**
   * Borra fisicamente un item de la cola por id.
   *
   * NO esta en la interface dominio `ColaSincronizacion` (congelada
   * D33) — vive solo en este adapter mobile. La motivacion es la
   * compensacion del adapter `persistir-y-encolar-alta-suscriptor`:
   * cuando el alta de medidor falla y borramos el suscriptor de
   * SQLite, queremos sacar el item SUSCRIPTOR de la cola para que
   * no intente sincronizar una entidad inexistente. Marcarlo
   * DESCARTADO via guardar() funciona pero deja basura.
   *
   * Idempotente: si el id no existe, no hace nada (DELETE de 0 rows).
   */
  eliminar(id: string): Promise<void>;
}

export function crearColaRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): ColaRepositoryExpoSqlite {
  return {
    async guardar(item: ItemCola): Promise<void> {
      await db.runAsync(
        SQL_UPSERT,
        item.id,
        item.tipo,
        JSON.stringify(item.payload),
        item.hashLocal,
        item.hashServer ?? null,
        item.estado,
        item.intentos,
        item.ultimoError,
        item.ultimoIntentoEn !== null ? item.ultimoIntentoEn.toISOString() : null,
        item.creadoEn.toISOString(),
        item.dependeDe !== undefined ? JSON.stringify(item.dependeDe) : null,
        item.forzarSobrescribir === undefined
          ? null
          : item.forzarSobrescribir
          ? 1
          : 0,
      );
    },

    async listar(): Promise<ItemCola[]> {
      const rows = await db.getAllAsync<ColaRow>(SQL_SELECT_ALL);
      return rows.map(fromRow);
    },

    async listarPendientes(): Promise<ItemCola[]> {
      const rows = await db.getAllAsync<ColaRow>(SQL_SELECT_PENDIENTES);
      return rows.map(fromRow);
    },

    async buscarPorId(id: string): Promise<ItemCola | null> {
      const row = await db.getFirstAsync<ColaRow>(SQL_SELECT_BY_ID, id);
      return row ? fromRow(row) : null;
    },

    async eliminar(id: string): Promise<void> {
      await db.runAsync(SQL_DELETE_BY_ID, id);
    },

    async cerrar(): Promise<void> {
      await db.closeAsync();
    },
  };
}
