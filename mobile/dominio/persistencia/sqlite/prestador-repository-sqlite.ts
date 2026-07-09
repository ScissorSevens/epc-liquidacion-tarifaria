/**
 * Adapter SQLite de `PrestadorRepository`.
 *
 * Patrón espejo de `suscriptor-repository-sqlite.ts`: better-sqlite3
 * síncrono envuelto en async para cumplir el contrato del puerto.
 *
 * Mapeo Prestador <-> row:
 *  - `id_prestador` lo asigna SQLite via AUTOINCREMENT; lo leemos del
 *    `lastInsertRowid` post-INSERT. id=0 está reservado para el
 *    prestador legacy seedeado en migration 009.
 *  - `created_at` y `updated_at` los asigna SQLite via DEFAULT
 *    (strftime), los leemos en el SELECT siguiente al INSERT.
 *  - `contacto` se persiste como NULL si viene null; al leer, si la
 *    columna es NULL se OMITE del objeto (no contamina `Object.keys`).
 *  - `segmento` se castea al literal union `1|2` confiando en el
 *    CHECK del schema (defensa en profundidad).
 *
 * Errores: usa `mapearErrorSqlite` y agrega traducción específica para
 * UK violado en `codigo` -> mensaje de dominio claro.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { mapearErrorSqlite } from './errores';
import type {
  ActualizarPrestadorInput,
  CrearPrestadorInput,
  FiltrosListarPrestador,
  Prestador,
  PrestadorRepository,
} from '../../prestadores';

export interface PrestadorRepositorySqlite extends PrestadorRepository {
  cerrar(): void;
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
  };
}

const SQL_INSERT = `
  INSERT INTO prestador (
    codigo, nombre, nit, representante_legal, representante_legal_cedula,
    municipio, departamento, segmento,
    num_suscriptores_urbanos, num_suscriptores_rurales, contacto, estado
  ) VALUES (
    @codigo, @nombre, @nit, @representante_legal, @representante_legal_cedula,
    @municipio, @departamento, @segmento,
    @num_suscriptores_urbanos, @num_suscriptores_rurales, @contacto, @estado
  )
`;

const SQL_SELECT_BY_ID = `SELECT * FROM prestador WHERE id_prestador = ?`;
const SQL_EXISTE_POR_CODIGO = `SELECT 1 FROM prestador WHERE codigo = ? LIMIT 1`;

function traducirErrorAdapter(err: unknown, ctx: { codigo?: string }): Error {
  const mapeado = mapearErrorSqlite(err, { tabla: 'prestador' });
  if (mapeado.cause.codigo === 'RESTRICCION_UNICIDAD' && ctx.codigo !== undefined) {
    const e = new Error(`Ya existe un prestador con codigo '${ctx.codigo}'`);
    Object.defineProperty(e, 'cause', {
      value: { codigo: 'RESTRICCION_UNICIDAD', ctx: { codigo: ctx.codigo } },
      enumerable: true,
    });
    return e;
  }
  return mapeado;
}

export function crearPrestadorRepositorySqlite(
  db: DatabaseType,
): PrestadorRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtExistePorCodigo = db.prepare(SQL_EXISTE_POR_CODIGO);
  const stmtUpdate = db.prepare(`
    UPDATE prestador
    SET nombre = @nombre,
        nit = @nit,
        municipio = @municipio,
        departamento = @departamento,
        segmento = @segmento,
        num_suscriptores_urbanos = @num_suscriptores_urbanos,
        num_suscriptores_rurales = @num_suscriptores_rurales,
        contacto = @contacto,
        updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now')
    WHERE id_prestador = @id_prestador
  `);
  // (representante_legal y representante_legal_cedula NO se actualizan
  // desde la UI: son datos del prestador definidos en SetupInicial que
  // requieren cambio manual del admin. Mantener fuera del UPDATE evita
  // pisar accidentalmente el rep. legal con null/undefined.)
  const stmtSuspender = db.prepare(`
    UPDATE prestador
    SET estado = 'suspendido',
        updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now')
    WHERE id_prestador = ?
  `);
  const stmtReactivar = db.prepare(`
    UPDATE prestador
    SET estado = 'activo',
        updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now')
    WHERE id_prestador = ?
  `);

  function toInsertParams(p: CrearPrestadorInput): Record<string, unknown> {
    return {
      codigo: p.codigo,
      nombre: p.nombre,
      nit: p.nit,
      representante_legal: p.representante_legal,
      representante_legal_cedula: p.representante_legal_cedula,
      municipio: p.municipio,
      departamento: p.departamento,
      segmento: p.segmento,
      num_suscriptores_urbanos: p.num_suscriptores_urbanos,
      num_suscriptores_rurales: p.num_suscriptores_rurales,
      contacto: p.contacto ?? null,
      estado: p.estado ?? 'activo',
    };
  }

  function buildListarQuery(filtros?: FiltrosListarPrestador): { sql: string; params: unknown[] } {
    const wheres: string[] = [];
    const params: unknown[] = [];
    if (filtros?.estado !== undefined) {
      wheres.push('estado = ?');
      params.push(filtros.estado);
    }
    if (filtros?.segmento !== undefined) {
      wheres.push('segmento = ?');
      params.push(filtros.segmento);
    }
    if (filtros?.search !== undefined && filtros.search.length > 0) {
      wheres.push('(codigo LIKE ? OR nombre LIKE ? OR municipio LIKE ? OR nit LIKE ?)');
      const s = `%${filtros.search}%`;
      params.push(s, s, s, s);
    }
    const where = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';
    const limit = filtros?.limit ?? 50;
    const page = filtros?.page ?? 1;
    const offset = (page - 1) * limit;
    const sql = `SELECT * FROM prestador ${where} ORDER BY codigo ASC LIMIT ? OFFSET ?`;
    return { sql, params: [...params, limit, offset] };
  }

  return {
    async crear(data: CrearPrestadorInput): Promise<Prestador> {
      let info;
      try {
        info = stmtInsert.run(toInsertParams(data));
      } catch (e) {
        throw traducirErrorAdapter(e, { codigo: data.codigo });
      }
      const id = Number(info.lastInsertRowid);
      const row = stmtSelectById.get(id) as PrestadorRow | undefined;
      if (!row) {
        throw new Error('crear: prestador no fue persistido (estado inesperado)');
      }
      return fromRow(row);
    },

    async obtenerPorId(id_prestador: number): Promise<Prestador | null> {
      const row = stmtSelectById.get(id_prestador) as PrestadorRow | undefined;
      return row ? fromRow(row) : null;
    },

    async existePorCodigo(codigo: string): Promise<boolean> {
      const row = stmtExistePorCodigo.get(codigo);
      return row !== undefined;
    },

    async listar(filtros?: FiltrosListarPrestador): Promise<readonly Prestador[]> {
      const { sql, params } = buildListarQuery(filtros);
      const rows = db.prepare(sql).all(...params) as PrestadorRow[];
      return rows.map(fromRow);
    },

    async actualizar(id_prestador: number, cambios: ActualizarPrestadorInput): Promise<Prestador> {
      const actual = stmtSelectById.get(id_prestador) as PrestadorRow | undefined;
      if (!actual) {
        throw new Error('actualizar: prestador no encontrado');
      }
      const params = {
        id_prestador,
        nombre: cambios.nombre ?? actual.nombre,
        nit: cambios.nit ?? actual.nit,
        municipio: cambios.municipio ?? actual.municipio,
        departamento: cambios.departamento ?? actual.departamento,
        segmento: cambios.segmento ?? actual.segmento,
        num_suscriptores_urbanos: cambios.num_suscriptores_urbanos ?? actual.num_suscriptores_urbanos,
        num_suscriptores_rurales: cambios.num_suscriptores_rurales ?? actual.num_suscriptores_rurales,
        contacto: cambios.contacto ?? actual.contacto,
      };
      stmtUpdate.run(params);
      const row = stmtSelectById.get(id_prestador) as PrestadorRow | undefined;
      if (!row) {
        throw new Error('actualizar: prestador no encontrado post-update');
      }
      return fromRow(row);
    },

    async suspender(id_prestador: number): Promise<Prestador> {
      const result = stmtSuspender.run(id_prestador);
      if (result.changes === 0) {
        throw new Error('suspender: prestador no encontrado');
      }
      const row = stmtSelectById.get(id_prestador) as PrestadorRow | undefined;
      if (!row) {
        throw new Error('suspender: prestador no encontrado post-update');
      }
      return fromRow(row);
    },

    async reactivar(id_prestador: number): Promise<Prestador> {
      const result = stmtReactivar.run(id_prestador);
      if (result.changes === 0) {
        throw new Error('reactivar: prestador no encontrado');
      }
      const row = stmtSelectById.get(id_prestador) as PrestadorRow | undefined;
      if (!row) {
        throw new Error('reactivar: prestador no encontrado post-update');
      }
      return fromRow(row);
    },

    cerrar(): void {
      db.close();
    },
  };
}
