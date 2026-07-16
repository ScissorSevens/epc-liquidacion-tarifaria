/**
 * Adapter expo-sqlite de `SuscriptorRepository` para la app movil.
 *
 * Espejo async de `src/persistencia/sqlite/suscriptor-repository-sqlite.ts`
 * (Node / better-sqlite3). Misma interfaz publica, todos los metodos
 * `Promise<>`. Diferencias principales:
 *  - `db.runAsync(sql, ...params)` para INSERT/UPDATE.
 *  - `db.getFirstAsync(sql, ...params)` para SELECT singular.
 *  - `db.getAllAsync(sql, ...params)` para SELECT multiple.
 *  - `result.lastInsertRowId` (camelCase, distinto de `lastInsertRowid`
 *    de better-sqlite3).
 *  - El mapeo de errores SQLite va por substring del mensaje (ver
 *    `traducir-error.ts`): expo-sqlite no expone `.code` discreto.
 *  - `actualizar` esta implementado con SQL real (UPDATE + re-fetch).
 *  - `eliminar` es stub honesto — fuera de scope de la version actual.
 *
 * IMPORTANTE: este adapter NO esta cubierto por jest del root (no hay
 * infra jest mobile). Validacion contractual: tests Node del adapter
 * espejo. Si cambia el contrato, espejarlo aca a mano.
 */

import type * as SQLite from 'expo-sqlite';
import type {
  ActualizarSuscriptorInput,
  Suscriptor,
  SuscriptorBorrador,
  SuscriptorRepository,
} from '@dominio/suscriptores';
import { mapearErrorExpoSqlite } from './traducir-error';

export interface SuscriptorRepositoryExpoSqlite extends SuscriptorRepository {
  cerrar(): Promise<void>;
  toggleSubsidio(id: number, valor: boolean): Promise<Suscriptor>;
}

interface SuscriptorRow {
  readonly id_suscriptor: number;
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly cedula: string;
  readonly municipio: string;
  readonly sector: string | null;
  readonly calle: string | null;
  readonly direccion: string;
  readonly estrato: number;
  readonly matricula_inmobiliaria: string | null;
  readonly numero_catastral: string | null;
  readonly aplica_subsidio: number;
  readonly id_prestador: number;
  readonly categoria_uso: Suscriptor['categoria_uso'];
  readonly estado: string;
  readonly created_at: string;
}

function fromRow(row: SuscriptorRow): Suscriptor {
  const sus: Suscriptor = {
    id_suscriptor: row.id_suscriptor,
    codigo: row.codigo,
    nombre_apellidos: row.nombre_apellidos,
    cedula: row.cedula,
    municipio: row.municipio,
    direccion: row.direccion,
    estrato: row.estrato as Suscriptor['estrato'],
    aplica_subsidio: row.aplica_subsidio === 1,
    id_prestador: row.id_prestador,
    categoria_uso: row.categoria_uso,
    estado: row.estado as Suscriptor['estado'],
    created_at: row.created_at,
    ...(row.sector !== null && { sector: row.sector }),
    ...(row.calle !== null && { calle: row.calle }),
    ...(row.matricula_inmobiliaria !== null && {
      matricula_inmobiliaria: row.matricula_inmobiliaria,
    }),
    ...(row.numero_catastral !== null && {
      numero_catastral: row.numero_catastral,
    }),
  };
  return sus;
}

const SQL_INSERT = `
  INSERT INTO suscriptor (
    codigo, nombre_apellidos, direccion, estrato,
    matricula_inmobiliaria, numero_catastral, estado, aplica_subsidio,
    cedula, municipio, sector
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SQL_SELECT_BY_ID = `SELECT * FROM suscriptor WHERE id_suscriptor = ?`;
const SQL_SELECT_BY_CODIGO = `SELECT * FROM suscriptor WHERE codigo = ?`;
const SQL_EXISTE_POR_CODIGO = `SELECT 1 AS uno FROM suscriptor WHERE codigo = ? LIMIT 1`;
const SQL_MAX_CODIGO = `SELECT MAX(CAST(codigo AS INTEGER)) AS max_codigo FROM suscriptor`;
// Listar ordenado por codigo ASC (igual que el adapter Node): es el
// orden natural de presentacion para listas de clientes.
const SQL_LISTAR = `SELECT * FROM suscriptor ORDER BY codigo ASC`;
const SQL_UPDATE_SUBSIDIO = `UPDATE suscriptor SET aplica_subsidio = ? WHERE id_suscriptor = ?`;

/**
 * Columnas permitidas en el UPDATE parcial. La whitelist es deliberada:
 * `cambios` cruza un boundary de datos y no puede convertirse directamente
 * en SQL sin controlar sus claves.
 */
const COLUMNAS_ACTUALIZABLES: ReadonlyArray<keyof SuscriptorRow> = [
  'nombre_apellidos',
  'cedula',
  'municipio',
  'sector',
  'calle',
  'direccion',
  'estrato',
  'matricula_inmobiliaria',
  'numero_catastral',
  'aplica_subsidio',
  'categoria_uso',
  'id_prestador',
  'estado',
];

function toSqlValue(
  value: ActualizarSuscriptorInput[keyof ActualizarSuscriptorInput] | undefined,
): string | number | null {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

/**
 * Traduce errores expo-sqlite a mensajes de dominio especificos para
 * Suscriptor. Espeja la logica de `traducirErrorAdapter` del adapter
 * Node, pero reemplaza `mapearErrorSqlite` por `mapearErrorExpoSqlite`.
 */
function traducirError(err: unknown, ctx: { codigo?: string }): Error {
  const mapeado = mapearErrorExpoSqlite(err, { tabla: 'suscriptor' });
  if (mapeado.cause.codigo === 'RESTRICCION_UNICIDAD' && ctx.codigo !== undefined) {
    const e = new Error(`Ya existe un suscriptor con codigo '${ctx.codigo}'`);
    Object.defineProperty(e, 'cause', {
      value: { codigo: 'RESTRICCION_UNICIDAD', ctx: { codigo: ctx.codigo } },
      enumerable: true,
    });
    return e;
  }
  return mapeado;
}

export function crearSuscriptorRepositoryExpoSqlite(
  db: SQLite.SQLiteDatabase,
): SuscriptorRepositoryExpoSqlite {
  return {
    async crear(data: SuscriptorBorrador): Promise<Suscriptor> {
      let result: SQLite.SQLiteRunResult;
      try {
        result = await db.runAsync(
          SQL_INSERT,
          data.codigo,
          data.nombre_apellidos,
          data.direccion,
          data.estrato,
          data.matricula_inmobiliaria ?? null,
          data.numero_catastral ?? null,
          data.estado,
          data.aplica_subsidio ? 1 : 0,
          data.cedula,
          data.municipio,
          data.sector ?? null,
        );
      } catch (e) {
        throw traducirError(e, { codigo: data.codigo });
      }
      const id = Number(result.lastInsertRowId);
      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_ID, id);
      if (!row) {
        throw new Error('crear: suscriptor no fue persistido (estado inesperado)');
      }
      return fromRow(row);
    },

    async buscarPorId(id: number): Promise<Suscriptor | null> {
      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_ID, id);
      return row ? fromRow(row) : null;
    },

    async buscarPorCodigo(codigo: string): Promise<Suscriptor | null> {
      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_CODIGO, codigo);
      return row ? fromRow(row) : null;
    },

    async existePorCodigo(codigo: string): Promise<boolean> {
      const row = await db.getFirstAsync<{ uno: number }>(
        SQL_EXISTE_POR_CODIGO,
        codigo,
      );
      return row !== null;
    },

    async maxCodigo(): Promise<string | null> {
      const row = await db.getFirstAsync<{ max_codigo: number | null }>(SQL_MAX_CODIGO);
      if (!row || row.max_codigo === null) return null;
      return String(row.max_codigo).padStart(4, '0');
    },

    async listar(): Promise<Suscriptor[]> {
      const rows = await db.getAllAsync<SuscriptorRow>(SQL_LISTAR);
      return rows.map(fromRow);
    },

    async actualizar(id: number, cambios: ActualizarSuscriptorInput): Promise<Suscriptor> {
      const camposActualizar = COLUMNAS_ACTUALIZABLES.filter((k) => k in cambios);

      if (camposActualizar.length === 0) {
        const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_ID, id);
        if (!row) throw new Error(`Suscriptor id=${id} no existe`);
        return fromRow(row);
      }

      const setClauses = camposActualizar.map((k) => `${k} = ?`).join(', ');
      const values = camposActualizar.map((k) =>
        toSqlValue(cambios[k as keyof ActualizarSuscriptorInput]),
      );

      await db.runAsync(
        `UPDATE suscriptor SET ${setClauses} WHERE id_suscriptor = ?`,
        ...values,
        id,
      );

      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_ID, id);
      if (!row) throw new Error(`Suscriptor id=${id} no existe`);
      return fromRow(row);
    },

    async toggleSubsidio(id: number, valor: boolean): Promise<Suscriptor> {
      await db.runAsync(SQL_UPDATE_SUBSIDIO, valor ? 1 : 0, id);
      const row = await db.getFirstAsync<SuscriptorRow>(SQL_SELECT_BY_ID, id);
      if (!row) throw new Error(`toggleSubsidio: suscriptor ${id} no encontrado`);
      return fromRow(row);
    },

    async eliminar(_id: number): Promise<void> {
      throw new Error(
        'eliminar: no implementado todavia — fuera de scope de la versión actual',
      );
    },

    async cerrar(): Promise<void> {
      await db.closeAsync();
    },
  };
}
