/**
 * Adapter expo-sqlite de `OperarioRepository` para la app móvil.
 *
 * Lee operarios cacheados localmente (sincronizados desde el backend).
 * IMPORTANTE: password_hash NO se persiste en mobile (seguridad).
 *
 * La tabla se crea con `CREATE TABLE IF NOT EXISTS` — idempotente.
 * Llamar `inicializar()` antes de usar cualquier otra función.
 */

import type * as SQLite from 'expo-sqlite';
import type { Operario } from '../../operarios/types';

interface OperarioRow {
  readonly id_operario: number;
  readonly id_prestador: number;
  readonly numero_cedula: string;
  readonly nombre: string;
  readonly email: string;
  readonly rol: string;
  readonly estado: string;
  readonly dispositivo_id: string | null;
  readonly created_at: string | null;
}

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS operarios (
  id_operario    INTEGER PRIMARY KEY,
  id_prestador   INTEGER NOT NULL DEFAULT 0,
  numero_cedula  TEXT NOT NULL UNIQUE,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL,
  rol            TEXT NOT NULL DEFAULT 'operario',
  estado         TEXT NOT NULL DEFAULT 'activo',
  dispositivo_id TEXT,
  created_at     TEXT
)
`;

const SQL_LISTAR = `SELECT * FROM operarios ORDER BY nombre ASC`;
const SQL_BUSCAR_POR_DISPOSITIVO = `SELECT * FROM operarios WHERE dispositivo_id = ? LIMIT 1`;
const SQL_UPSERT = `
INSERT INTO operarios (id_operario, id_prestador, numero_cedula, nombre, email, rol, estado, dispositivo_id, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id_operario) DO UPDATE SET
  id_prestador   = excluded.id_prestador,
  numero_cedula  = excluded.numero_cedula,
  nombre         = excluded.nombre,
  email          = excluded.email,
  rol            = excluded.rol,
  estado         = excluded.estado,
  dispositivo_id = excluded.dispositivo_id,
  created_at     = excluded.created_at
`;

function fromRow(row: OperarioRow): Operario {
  return {
    id_operario: row.id_operario,
    id_prestador: row.id_prestador,
    numero_cedula: row.numero_cedula,
    nombre: row.nombre,
    email: row.email,
    rol: row.rol,
    estado: row.estado,
    ...(row.dispositivo_id !== null && { dispositivo_id: row.dispositivo_id }),
    ...(row.created_at !== null && { created_at: row.created_at }),
  };
}

export interface OperarioRepositoryExpoSqlite {
  inicializar(): Promise<void>;
  listar(): Promise<Operario[]>;
  buscarPorDispositivoId(id: string): Promise<Operario | null>;
  guardar(operario: Operario): Promise<void>;
}

export function crearOperarioRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): OperarioRepositoryExpoSqlite {
  return {
    async inicializar(): Promise<void> {
      await db.execAsync(SQL_CREATE_TABLE);
    },

    async listar(): Promise<Operario[]> {
      const rows = await db.getAllAsync<OperarioRow>(SQL_LISTAR);
      return rows.map(fromRow);
    },

    async buscarPorDispositivoId(id: string): Promise<Operario | null> {
      const row = await db.getFirstAsync<OperarioRow>(SQL_BUSCAR_POR_DISPOSITIVO, id);
      return row ? fromRow(row) : null;
    },

    async guardar(operario: Operario): Promise<void> {
      await db.runAsync(SQL_UPSERT,
        operario.id_operario,
        operario.id_prestador,
        operario.numero_cedula,
        operario.nombre,
        operario.email,
        operario.rol,
        operario.estado,
        operario.dispositivo_id ?? null,
        operario.created_at ?? null,
      );
    },
  };
}
