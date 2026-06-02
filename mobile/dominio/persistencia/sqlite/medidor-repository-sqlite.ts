/**
 * Adapter SQLite de `MedidorRepository`.
 *
 * Espejo del patron `suscriptor-repository-sqlite.ts`. better-sqlite3
 * sincrono envuelto en async para cumplir el contrato del puerto.
 *
 * Mapeo Medidor <-> row:
 *  - `id_medidor` lo asigna SQLite via AUTOINCREMENT; lo leemos del
 *    `lastInsertRowid` post-INSERT.
 *  - `created_at` lo asigna SQLite via DEFAULT (strftime).
 *  - `observaciones` se persiste como NULL si viene undefined; al leer,
 *    si la columna es NULL se OMITE del objeto.
 *
 * Errores:
 *  - UK violado en `numero_medidor` -> mensaje "Ya existe un medidor
 *    con numero 'X'" + cause.codigo='RESTRICCION_UNICIDAD'.
 *  - FK violada (id_suscriptor inexistente) -> mensaje "Suscriptor X
 *    no existe" + cause.codigo='RESTRICCION_INTEGRIDAD' (que es lo que
 *    `mapearErrorSqlite` devuelve para SQLITE_CONSTRAINT_FOREIGNKEY).
 *
 * MVP: `actualizar` y `eliminar` son stubs honestos (lanzan error
 * explicito). Quedan para post-entrega.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { mapearErrorSqlite } from './errores';
import type {
  ActualizarMedidorInput,
  Medidor,
  MedidorBorrador,
  MedidorRepository,
} from '../../medidores';

export interface MedidorRepositorySqlite extends MedidorRepository {
  cerrar(): void;
}

interface MedidorRow {
  readonly id_medidor: number;
  readonly numero_medidor: string;
  readonly id_suscriptor: number;
  readonly fecha_instalacion: string;
  readonly estado: string;
  readonly observaciones: string | null;
  readonly created_at: string;
}

function fromRow(row: MedidorRow): Medidor {
  const m: Medidor = {
    id_medidor: row.id_medidor,
    numero_medidor: row.numero_medidor,
    id_suscriptor: row.id_suscriptor,
    fecha_instalacion: row.fecha_instalacion,
    estado: row.estado as Medidor['estado'],
    created_at: row.created_at,
    ...(row.observaciones !== null && { observaciones: row.observaciones }),
  };
  return m;
}

const SQL_INSERT = `
  INSERT INTO medidor (
    numero_medidor, id_suscriptor, fecha_instalacion, estado, observaciones
  ) VALUES (
    @numero_medidor, @id_suscriptor, @fecha_instalacion, @estado, @observaciones
  )
`;

const SQL_SELECT_BY_ID = `SELECT * FROM medidor WHERE id_medidor = ?`;
const SQL_SELECT_BY_NUMERO = `SELECT * FROM medidor WHERE numero_medidor = ?`;
const SQL_EXISTE_POR_NUMERO = `SELECT 1 FROM medidor WHERE numero_medidor = ? LIMIT 1`;
// Listar por suscriptor: ordenado por numero_medidor ASC.
const SQL_LISTAR_POR_SUSCRIPTOR = `SELECT * FROM medidor WHERE id_suscriptor = ? ORDER BY numero_medidor ASC`;
const SQL_LISTAR = `SELECT * FROM medidor ORDER BY numero_medidor ASC`;

function traducirErrorAdapter(
  err: unknown,
  ctx: { numero_medidor?: string; id_suscriptor?: number },
): Error {
  const mapeado = mapearErrorSqlite(err, { tabla: 'medidor' });
  const codigo = mapeado.cause.codigo;

  if (codigo === 'RESTRICCION_UNICIDAD' && ctx.numero_medidor !== undefined) {
    const e = new Error(`Ya existe un medidor con numero '${ctx.numero_medidor}'`);
    Object.defineProperty(e, 'cause', {
      value: {
        codigo: 'RESTRICCION_UNICIDAD',
        ctx: { numero_medidor: ctx.numero_medidor },
      },
      enumerable: true,
    });
    return e;
  }

  // FK violada: SQLITE_CONSTRAINT_FOREIGNKEY -> RESTRICCION_INTEGRIDAD.
  if (codigo === 'RESTRICCION_INTEGRIDAD' && ctx.id_suscriptor !== undefined) {
    const e = new Error(
      `Suscriptor ${ctx.id_suscriptor} no existe (FK invalida en medidor)`,
    );
    Object.defineProperty(e, 'cause', {
      value: {
        codigo: 'RESTRICCION_INTEGRIDAD',
        ctx: { id_suscriptor: ctx.id_suscriptor },
      },
      enumerable: true,
    });
    return e;
  }

  return mapeado;
}

export function crearMedidorRepositorySqlite(
  db: DatabaseType,
): MedidorRepositorySqlite {
  const stmtInsert = db.prepare(SQL_INSERT);
  const stmtSelectById = db.prepare(SQL_SELECT_BY_ID);
  const stmtSelectByNumero = db.prepare(SQL_SELECT_BY_NUMERO);
  const stmtExistePorNumero = db.prepare(SQL_EXISTE_POR_NUMERO);
  const stmtListarPorSuscriptor = db.prepare(SQL_LISTAR_POR_SUSCRIPTOR);
  const stmtListar = db.prepare(SQL_LISTAR);

  function toInsertParams(m: MedidorBorrador): Record<string, unknown> {
    return {
      numero_medidor: m.numero_medidor,
      id_suscriptor: m.id_suscriptor,
      fecha_instalacion: m.fecha_instalacion,
      estado: m.estado,
      observaciones: m.observaciones ?? null,
    };
  }

  return {
    async crear(data: MedidorBorrador): Promise<Medidor> {
      let info;
      try {
        info = stmtInsert.run(toInsertParams(data));
      } catch (e) {
        throw traducirErrorAdapter(e, {
          numero_medidor: data.numero_medidor,
          id_suscriptor: data.id_suscriptor,
        });
      }
      const id = Number(info.lastInsertRowid);
      const row = stmtSelectById.get(id) as MedidorRow | undefined;
      if (!row) {
        throw new Error('crear: medidor no fue persistido (estado inesperado)');
      }
      return fromRow(row);
    },

    async buscarPorId(id: number): Promise<Medidor | null> {
      const row = stmtSelectById.get(id) as MedidorRow | undefined;
      return row ? fromRow(row) : null;
    },

    async buscarPorNumero(numero: string): Promise<Medidor | null> {
      const row = stmtSelectByNumero.get(numero) as MedidorRow | undefined;
      return row ? fromRow(row) : null;
    },

    async existePorNumero(numero: string): Promise<boolean> {
      const row = stmtExistePorNumero.get(numero);
      return row !== undefined;
    },

    async listarPorSuscriptor(idSuscriptor: number): Promise<Medidor[]> {
      const rows = stmtListarPorSuscriptor.all(idSuscriptor) as MedidorRow[];
      return rows.map(fromRow);
    },

    async listar(): Promise<Medidor[]> {
      const rows = stmtListar.all() as MedidorRow[];
      return rows.map(fromRow);
    },

    async actualizar(_id: number, _cambios: ActualizarMedidorInput): Promise<Medidor> {
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
