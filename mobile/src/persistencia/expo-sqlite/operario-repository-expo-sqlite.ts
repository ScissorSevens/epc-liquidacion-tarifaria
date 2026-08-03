/**
 * Adapter expo-sqlite de `OperarioRepository` para la app móvil.
 *
 * Lee operarios cacheados localmente (sincronizados desde el backend).
 *
 * PUNTO A (Login real local): `password_hash` SI se persiste en mobile.
 * Es la única forma de validar login offline contra SQLite sin pedirle
 * al operario que se conecte al backend. El hash es SHA-256 (no plain),
 * generado por el `Hasher` inyectado en bootstrapCompleto (Fase 5.1).
 * Trade-off de seguridad documentado en
 * TICKET-EPIC-LOGIN-001 / PUNTO A (2026-07-09):
 *   - MVP: stored hash OK para demo offline.
 *   - Producción: cuando llegue el backend (Fase 6), el hash se reemplaza
 *     por un token de sesión opaco y este flujo deja de usarse.
 *
 * La tabla se crea con `CREATE TABLE IF NOT EXISTS` — idempotente.
 * Llamar `inicializar()` antes de usar cualquier otra función.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  ActualizarOperarioInput,
  Operario as OperarioDominio,
  OperarioBorrador,
} from '../../../dominio/operarios/types';
import type { Operario as OperarioMobile } from '../../operarios/types';

interface OperarioRow {
  readonly id_operario: number;
  readonly id_prestador: number;
  readonly numero_cedula: string;
  readonly nombre: string;
  readonly email: string;
  /**
   * Hash SHA-256 de la contraseña del operario. Persistido para permitir
   * login offline (PUNTO A). Ver doc del archivo.
   */
  readonly password_hash: string;
  readonly rol: string;
  readonly estado: string;
  readonly dispositivo_id: string | null;
  readonly created_at: string | null;
}

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS operarios (
  id_operario    INTEGER PRIMARY KEY AUTOINCREMENT,
  id_prestador   INTEGER NOT NULL DEFAULT 0,
  numero_cedula  TEXT NOT NULL UNIQUE,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL DEFAULT '',
  rol            TEXT NOT NULL DEFAULT 'operario',
  estado         TEXT NOT NULL DEFAULT 'activo',
  dispositivo_id TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
`;

const SQL_LISTAR = `SELECT * FROM operarios ORDER BY nombre ASC`;
const SQL_LISTAR_POR_PRESTADOR = `SELECT * FROM operarios WHERE id_prestador = ? ORDER BY nombre ASC`;
const SQL_BUSCAR_POR_ID = `SELECT * FROM operarios WHERE id_operario = ? LIMIT 1`;
const SQL_CREAR = `
INSERT INTO operarios (
  id_prestador, numero_cedula, nombre, email, password_hash, rol, estado, dispositivo_id
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;
const SQL_BUSCAR_POR_CEDULA = `SELECT * FROM operarios WHERE numero_cedula = ? LIMIT 1`;
const SQL_BUSCAR_POR_DISPOSITIVO = `SELECT * FROM operarios WHERE dispositivo_id = ? LIMIT 1`;
const SQL_BUSCAR_POR_DISPOSITIVO_Y_PRESTADOR =
  `SELECT * FROM operarios WHERE dispositivo_id = ? AND id_prestador = ? LIMIT 1`;
const SQL_UPSERT = `
INSERT INTO operarios (id_operario, id_prestador, numero_cedula, nombre, email, password_hash, rol, estado, dispositivo_id, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id_operario) DO UPDATE SET
  id_prestador   = excluded.id_prestador,
  numero_cedula  = excluded.numero_cedula,
  nombre         = excluded.nombre,
  email          = excluded.email,
  password_hash  = excluded.password_hash,
  rol            = excluded.rol,
  estado         = excluded.estado,
  dispositivo_id = excluded.dispositivo_id,
  created_at     = excluded.created_at
`;

const SQL_ELIMINAR_POR_CEDULA = `DELETE FROM operarios WHERE numero_cedula = ?`;
const SQL_ELIMINAR_POR_ID = `DELETE FROM operarios WHERE id_operario = ?`;

/**
 * Columnas actualizables vía `actualizar()`. Refleja
 * `ActualizarOperarioInput` del dominio pero a nivel SQL.
 */
const COLUMNAS_ACTUALIZABLES: ReadonlyArray<keyof OperarioRow> = [
  'id_prestador',
  'numero_cedula',
  'nombre',
  'email',
  'password_hash',
  'rol',
  'estado',
  'dispositivo_id',
  'created_at',
];

function fromRow(row: OperarioRow): OperarioMobile {
  return {
    id_operario: row.id_operario,
    id_prestador: row.id_prestador,
    numero_cedula: row.numero_cedula,
    nombre: row.nombre,
    email: row.email,
    password_hash: row.password_hash,
    rol: row.rol,
    estado: row.estado,
    ...(row.dispositivo_id !== null && { dispositivo_id: row.dispositivo_id }),
    ...(row.created_at !== null && { created_at: row.created_at }),
  };
}

function fromRowDomain(row: OperarioRow): OperarioDominio {
  if (row.created_at === null) {
    throw new Error('crear: operario persistido sin created_at');
  }

  return {
    ...fromRow(row),
    rol: row.rol as OperarioDominio['rol'],
    estado: row.estado as OperarioDominio['estado'],
    created_at: row.created_at,
  };
}

/**
 * Construye y ejecuta un UPDATE dinámico basado en las claves presentes
 * en `cambios`. Solo las columnas enumeradas en COLUMNAS_ACTUALIZABLES
 * son modificables (filtro defensivo contra keys inesperadas).
 *
 * @returns fila actualizada (leída de la DB para reflejar el rowid real).
 */
function ejecutarActualizacion(
  db: SQLite.SQLiteDatabase,
  id: number,
  cambios: ActualizarOperarioInput,
): Promise<OperarioMobile> {
  const sets: string[] = [];
  const valores: Array<string | number | null> = [];
  for (const columna of COLUMNAS_ACTUALIZABLES) {
    const valor = (cambios as Record<string, unknown>)[columna];
    if (Object.prototype.hasOwnProperty.call(cambios, columna)) {
      sets.push(`${columna} = ?`);
      // dispositivo_id y created_at admiten null explícito (limpieza de cache).
      valores.push(valor === undefined ? null : (valor as string | number | null));
    }
  }
  if (sets.length === 0) {
    // Nada que actualizar → retornamos la fila actual.
    return db
      .getFirstAsync<OperarioRow>(SQL_BUSCAR_POR_ID, id)
      .then((row) => {
        if (!row) throw new Error(`Operario id=${id} no existe`);
        return fromRow(row);
      });
  }
  valores.push(id);
  const sql = `UPDATE operarios SET ${sets.join(', ')} WHERE id_operario = ?`;
  return db
    .runAsync(sql, ...valores)
    .then(() => db.getFirstAsync<OperarioRow>(SQL_BUSCAR_POR_ID, id))
    .then((row) => {
      if (!row) throw new Error(`Operario id=${id} no existe tras actualizar`);
      return fromRow(row);
    });
}

export interface OperarioRepositoryExpoSqlite {
  inicializar(): Promise<void>;
  crear(borrador: OperarioBorrador): Promise<OperarioDominio>;
  listar(): Promise<OperarioMobile[]>;
  listarPorPrestador(idPrestador: number): Promise<OperarioMobile[]>;
  buscarPorId(id: number): Promise<OperarioMobile | null>;
  buscarPorCedula(cedula: string): Promise<OperarioMobile | null>;
  /**
   * Búsqueda por dispositivo_id ONLY (single key). Conservada por
   * compatibilidad con `pantallas/Configuracion.tsx`; para filtrado
   * multi-tenant usar `buscarPorDispositivo(dispositivoId, idPrestador)`.
   */
  buscarPorDispositivoId(id: string): Promise<OperarioMobile | null>;
  /** Compuesto dispositivo_id + id_prestador (multi-tenant). */
  buscarPorDispositivo(dispositivoId: string, idPrestador: number): Promise<OperarioMobile | null>;
  guardar(operario: OperarioMobile): Promise<void>;
  actualizar(id: number, cambios: ActualizarOperarioInput): Promise<OperarioMobile>;
  eliminar(id_operario: number): Promise<void>;
  /**
   * Elimina un operario por cedula. Idempotente: borrar una cedula que no
   * existe es no-op (resuelve sin error). Usado por
   * `limpiarDatosLegacyBypass()` para borrar el operario 'placeholder'
   * que creaba el bypass viejo de Configuracion.tsx (eliminado en 4.3.1).
   */
  eliminarPorCedula(cedula: string): Promise<void>;
}

export function crearOperarioRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): OperarioRepositoryExpoSqlite {
  return {
    async inicializar(): Promise<void> {
      await db.execAsync(SQL_CREATE_TABLE);
    },

    async crear(borrador: OperarioBorrador): Promise<OperarioDominio> {
      if (borrador.id_prestador === undefined) {
        throw new Error('crear: id_prestador es requerido');
      }

      const result = await db.runAsync(
        SQL_CREAR,
        borrador.id_prestador,
        borrador.numero_cedula,
        borrador.nombre,
        borrador.email,
        borrador.password_hash,
        borrador.rol,
        borrador.estado,
        borrador.dispositivo_id ?? null,
      );
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<OperarioRow>(SQL_BUSCAR_POR_ID, id);
      if (!row) throw new Error('crear: operario no fue persistido');
      return fromRowDomain(row);
    },

    async listar(): Promise<OperarioMobile[]> {
      const rows = await db.getAllAsync<OperarioRow>(SQL_LISTAR);
      return rows.map(fromRow);
    },

    async listarPorPrestador(idPrestador: number): Promise<OperarioMobile[]> {
      const rows = await db.getAllAsync<OperarioRow>(SQL_LISTAR_POR_PRESTADOR, idPrestador);
      return rows.map(fromRow);
    },

    async buscarPorId(id: number): Promise<OperarioMobile | null> {
      const row = await db.getFirstAsync<OperarioRow>(SQL_BUSCAR_POR_ID, id);
      return row ? fromRow(row) : null;
    },

    async buscarPorCedula(cedula: string): Promise<OperarioMobile | null> {
      const row = await db.getFirstAsync<OperarioRow>(SQL_BUSCAR_POR_CEDULA, cedula);
      return row ? fromRow(row) : null;
    },

    async buscarPorDispositivoId(id: string): Promise<OperarioMobile | null> {
      const row = await db.getFirstAsync<OperarioRow>(SQL_BUSCAR_POR_DISPOSITIVO, id);
      return row ? fromRow(row) : null;
    },

    async buscarPorDispositivo(
      dispositivoId: string,
      idPrestador: number,
    ): Promise<OperarioMobile | null> {
      const row = await db.getFirstAsync<OperarioRow>(
        SQL_BUSCAR_POR_DISPOSITIVO_Y_PRESTADOR,
        dispositivoId,
        idPrestador,
      );
      return row ? fromRow(row) : null;
    },

    async guardar(operario: OperarioMobile): Promise<void> {
      await db.runAsync(SQL_UPSERT,
        operario.id_operario,
        operario.id_prestador,
        operario.numero_cedula,
        operario.nombre,
        operario.email,
        operario.password_hash,
        operario.rol,
        operario.estado,
        operario.dispositivo_id ?? null,
        operario.created_at ?? null,
      );
    },

    actualizar(id: number, cambios: ActualizarOperarioInput): Promise<OperarioMobile> {
      return ejecutarActualizacion(db, id, cambios);
    },

    async eliminar(id_operario: number): Promise<void> {
      await db.runAsync(SQL_ELIMINAR_POR_ID, id_operario);
    },

    async eliminarPorCedula(cedula: string): Promise<void> {
      // DELETE es idempotente: si la cedula no matchea, expo-sqlite devuelve
      // changes: 0 sin rechazar. Esto permite que limpiarDatosLegacyBypass()
      // corra multiples veces en el mismo arranque sin romper nada.
      await db.runAsync(SQL_ELIMINAR_POR_CEDULA, cedula);
    },
  };
}