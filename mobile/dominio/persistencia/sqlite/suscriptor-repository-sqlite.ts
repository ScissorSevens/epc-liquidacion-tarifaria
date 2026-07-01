/**
 * Adapter SQLite de `SuscriptorRepository`.
 *
 * Espejo del patron `lectura-repository-sqlite.ts`: better-sqlite3
 * sincrono envuelto en async para cumplir el contrato del puerto.
 *
 * Mapeo Suscriptor <-> row:
 *  - `id_suscriptor` lo asigna SQLite via AUTOINCREMENT; lo leemos del
 *    `lastInsertRowid` post-INSERT.
 *  - `created_at` lo asigna SQLite via DEFAULT (strftime), lo leemos
 *    en el SELECT siguiente al INSERT.
 *  - `matricula_inmobiliaria` y `numero_catastral` se persisten como
 *    NULL si vienen undefined; al leer, si la columna es NULL se OMITE
 *    del objeto (para no contaminar `Object.keys`).
 *  - `estrato` lo casteamos al literal union `1|2|3|4|5|6` confiando en
 *    el CHECK del schema (defensa en profundidad).
 *
 * Errores: usa `mapearErrorSqlite` y agrega traduccion especifica para
 * UK violado en `codigo` -> mensaje de dominio claro.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { mapearErrorSqlite } from './errores';
import type {
  ActualizarSuscriptorInput,
  Suscriptor,
  SuscriptorBorrador,
  SuscriptorRepository,
} from '../../suscriptores';

export interface SuscriptorRepositorySqlite extends SuscriptorRepository {
  cerrar(): void;
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
  readonly estado: string;
  readonly created_at: string;
  readonly id_prestador: number;
  readonly categoria_uso: string;
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
    estado: row.estado as Suscriptor['estado'],
    created_at: row.created_at,
    id_prestador: row.id_prestador,
    categoria_uso: row.categoria_uso as Suscriptor['categoria_uso'],
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
    codigo, nombre_apellidos, cedula, municipio, sector, calle,
    direccion, estrato, matricula_inmobiliaria, numero_catastral,
    aplica_subsidio, estado, id_prestador, categoria_uso
  ) VALUES (
    @codigo, @nombre_apellidos, @cedula, @municipio, @sector, @calle,
    @direccion, @estrato, @matricula_inmobiliaria, @numero_catastral,
    @aplica_subsidio, @estado, @id_prestador, @categoria_uso
  )
`;

const SQL_SELECT_BY_ID = `SELECT * FROM suscriptor WHERE id_suscriptor = ?`;
const SQL_SELECT_BY_CODIGO = `SELECT * FROM suscriptor WHERE codigo = ?`;
const SQL_EXISTE_POR_CODIGO = `SELECT 1 FROM suscriptor WHERE codigo = ? LIMIT 1`;
// Listar ordenado por codigo ASC: es el orden natural de presentacion
// para listas de clientes (catalogo). El usuario reconoce el codigo
// EPC mas rapido que el id interno autoincremental.
const SQL_LISTAR = `SELECT * FROM suscriptor ORDER BY codigo ASC`;
const SQL_MAX_CODIGO = `SELECT MAX(codigo) AS max_codigo FROM suscriptor`;

function traducirErrorAdapter(err: unknown, ctx: { codigo?: string }): Error {
  const mapeado = mapearErrorSqlite(err, { tabla: 'suscriptor' });
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

export function crearSuscriptorRepositorySqlite(
  db: DatabaseType,
): SuscriptorRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtSelectByCodigo = db.prepare(SQL_SELECT_BY_CODIGO);
  const stmtExistePorCodigo = db.prepare(SQL_EXISTE_POR_CODIGO);
  const stmtListar = db.prepare(SQL_LISTAR);
  const stmtMaxCodigo = db.prepare(SQL_MAX_CODIGO);

  function toInsertParams(s: SuscriptorBorrador): Record<string, unknown> {
    return {
      codigo: s.codigo,
      nombre_apellidos: s.nombre_apellidos,
      cedula: s.cedula,
      municipio: s.municipio,
      sector: s.sector ?? null,
      calle: s.calle ?? null,
      direccion: s.direccion,
      estrato: s.estrato,
      matricula_inmobiliaria: s.matricula_inmobiliaria ?? null,
      numero_catastral: s.numero_catastral ?? null,
      aplica_subsidio: s.aplica_subsidio ? 1 : 0,
      estado: s.estado,
      id_prestador: s.id_prestador,
      categoria_uso: s.categoria_uso,
    };
  }

  return {
    async crear(data: SuscriptorBorrador): Promise<Suscriptor> {
      let info;
      try {
        info = stmtInsert.run(toInsertParams(data));
      } catch (e) {
        throw traducirErrorAdapter(e, { codigo: data.codigo });
      }
      const id = Number(info.lastInsertRowid);
      const row = stmtSelectById.get(id) as SuscriptorRow | undefined;
      if (!row) {
        throw new Error('crear: suscriptor no fue persistido (estado inesperado)');
      }
      return fromRow(row);
    },

    async buscarPorId(id: number): Promise<Suscriptor | null> {
      const row = stmtSelectById.get(id) as SuscriptorRow | undefined;
      return row ? fromRow(row) : null;
    },

    async buscarPorCodigo(codigo: string): Promise<Suscriptor | null> {
      const row = stmtSelectByCodigo.get(codigo) as SuscriptorRow | undefined;
      return row ? fromRow(row) : null;
    },

    async existePorCodigo(codigo: string): Promise<boolean> {
      const row = stmtExistePorCodigo.get(codigo);
      return row !== undefined;
    },

    async listar(): Promise<Suscriptor[]> {
      const rows = stmtListar.all() as SuscriptorRow[];
      return rows.map(fromRow);
    },

    async maxCodigo(): Promise<string | null> {
      const row = stmtMaxCodigo.get() as { max_codigo: string | null } | undefined;
      return row?.max_codigo ?? null;
    },

    async actualizar(_id: number, _cambios: ActualizarSuscriptorInput): Promise<Suscriptor> {
      throw new Error(
        'actualizar: no implementado todavia — fuera de scope MVP, ver post-entrega',
      );
    },

    async eliminar(_id: number): Promise<void> {
      throw new Error(
        'eliminar: no implementado todavia — fuera de scope MVP, ver post-entrega',
      );
    },

    cerrar(): void {
      db.close();
    },
  };
}
