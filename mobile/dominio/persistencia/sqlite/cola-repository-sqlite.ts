/**
 * Adapter SQLite de `ColaSincronizacion`.
 *
 * Mapeo ItemCola <-> row:
 *  - `id` es UUID TEXT (lo asigna `agregarItemACola`, no SQLite).
 *  - `payload` (unknown) y `dependeDe?` (string[]) se serializan como TEXT JSON.
 *  - `creadoEn` y `ultimoIntentoEn` (Date|null) se serializan como TEXT ISO 8601.
 *  - `forzarSobrescribir?` (boolean) se serializa como INTEGER 0/1 nullable.
 *  - Campos opcionales ausentes en el objeto (hashServer, dependeDe,
 *    forzarSobrescribir) se persisten como NULL; al leer se OMITEN del
 *    objeto (nunca se devuelven como null/undefined explicito que
 *    contamine `Object.keys`). Esto preserva la simetria con el in-memory.
 *  - `ultimoError` y `ultimoIntentoEn` SI vuelven como null (son nullable
 *    explicitos en el tipo, no opcionales).
 *
 * Semantica de `guardar`: UPSERT por id. Si el id existe, sobrescribe
 * todos los campos. Esto es lo que el in-memory hace (Map.set) y lo que
 * el harness exige (test "guardar dos veces el mismo id sobrescribe").
 *
 * Errores: usa `mapearErrorSqlite` (mapper hexagonal de infra). El
 * adapter no necesita traduccion adicional porque la cola no tiene
 * mensajes de dominio especiales (los CHECK de tipo/estado son
 * defensivos, jamas deberian dispararse si el dominio respeta los
 * tipos `TipoItem`/`EstadoItem`).
 *
 * Hexagonal: persistencia pura. Sin eventos.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type { ColaSincronizacion } from '../../sincronizacion/cola-repository';
import type { EstadoItem, ItemCola, TipoItem } from '../../sincronizacion/types';
import { mapearErrorSqlite } from './errores';

export interface ColaRepositorySqlite extends ColaSincronizacion {
  cerrar(): void;
}

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
    ultimoIntentoEn: row.ultimo_intento_en !== null ? new Date(row.ultimo_intento_en) : null,
    creadoEn: new Date(row.creado_en),
    ...(row.hash_server !== null && { hashServer: row.hash_server }),
    ...(row.depende_de !== null && { dependeDe: JSON.parse(row.depende_de) as string[] }),
    ...(row.forzar_sobrescribir !== null && {
      forzarSobrescribir: row.forzar_sobrescribir === 1,
    }),
  };
  return item;
}

function toUpsertParams(item: ItemCola): Record<string, unknown> {
  return {
    id: item.id,
    tipo: item.tipo,
    payload: JSON.stringify(item.payload),
    hash_local: item.hashLocal,
    hash_server: item.hashServer ?? null,
    estado: item.estado,
    intentos: item.intentos,
    ultimo_error: item.ultimoError,
    ultimo_intento_en: item.ultimoIntentoEn !== null ? item.ultimoIntentoEn.toISOString() : null,
    creado_en: item.creadoEn.toISOString(),
    depende_de: item.dependeDe !== undefined ? JSON.stringify(item.dependeDe) : null,
    forzar_sobrescribir:
      item.forzarSobrescribir === undefined ? null : item.forzarSobrescribir ? 1 : 0,
  };
}

const SQL_UPSERT = `
  INSERT INTO cola_sincronizacion (
    id, tipo, payload, hash_local, hash_server, estado, intentos, ultimo_error,
    ultimo_intento_en, creado_en, depende_de, forzar_sobrescribir
  ) VALUES (
    @id, @tipo, @payload, @hash_local, @hash_server, @estado, @intentos, @ultimo_error,
    @ultimo_intento_en, @creado_en, @depende_de, @forzar_sobrescribir
  )
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

export function crearColaSincronizacionSqlite(db: DatabaseType): ColaRepositorySqlite {
  const stmtUpsert = db.prepare(SQL_UPSERT);
  const stmtSelectAll = db.prepare(SQL_SELECT_ALL);
  const stmtSelectPendientes = db.prepare(SQL_SELECT_PENDIENTES);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);

  return {
    async guardar(item: ItemCola): Promise<void> {
      try {
        stmtUpsert.run(toUpsertParams(item));
      } catch (e) {
        throw mapearErrorSqlite(e, { tabla: 'cola_sincronizacion' });
      }
    },

    async listar(): Promise<ItemCola[]> {
      const rows = stmtSelectAll.all() as ColaRow[];
      return rows.map(fromRow);
    },

    async listarPendientes(): Promise<ItemCola[]> {
      const rows = stmtSelectPendientes.all() as ColaRow[];
      return rows.map(fromRow);
    },

    async buscarPorId(id: string): Promise<ItemCola | null> {
      const row = stmtSelectById.get(id) as ColaRow | undefined;
      return row ? fromRow(row) : null;
    },

    cerrar(): void {
      db.close();
    },
  };
}
