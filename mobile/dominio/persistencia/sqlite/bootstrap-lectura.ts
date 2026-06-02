/**
 * Bootstrap del modulo persistencia de lecturas con backend SQLite.
 *
 * Punto de entrada cableado que: abre conexion SQLite con `dbPath`
 * configurable, ejecuta migraciones pendientes idempotentemente, y
 * devuelve el `LecturaRepository` listo para usar junto con una funcion
 * de cierre limpio.
 *
 * Hexagonal: este modulo es composition root de infra. NO contiene
 * logica de dominio; solo cablea adapter (`crearLecturaRepositorySqlite`)
 * con infra (`crearConexion`, `ejecutarMigrations`).
 *
 * Espejo intencional de `src/factura/bootstrap.ts`. Si el patron de
 * bootstrap evoluciona (ej. inyeccion de logger), tocar AMBOS para
 * mantener consistencia entre modulos de persistencia.
 */

import { crearConexion } from './db';
import { ejecutarMigrations } from './migration-runner';
import { migrations } from './migrations';
import { crearLecturaRepositorySqlite } from './lectura-repository-sqlite';
import type { LecturaRepository } from '../lectura-repository';

export interface BootstrapLecturaSqliteOpciones {
  readonly dbPath: string;
}

export interface BootstrapLecturaSqlite {
  readonly repository: LecturaRepository;
  readonly cerrar: () => void;
}

/**
 * Cablea el modulo de persistencia de lecturas con SQLite.
 *
 * Lifecycle: el caller es responsable de invocar `cerrar()` cuando
 * termina (tipicamente al apagar el proceso).
 *
 * Errores: si `dbPath` no se puede abrir (directorio padre inexistente,
 * permisos, etc.), lanza un `Error` con mensaje de dominio en espaniol
 * y `cause.codigo = 'ERROR_PERSISTENCIA'` para que el caller pueda
 * distinguirlo de errores genericos. El error original queda en
 * `cause.original` para diagnostico.
 */
export function crearBootstrapLecturaSqlite(
  opciones: BootstrapLecturaSqliteOpciones,
): BootstrapLecturaSqlite {
  let db;
  try {
    db = crearConexion(opciones.dbPath);
  } catch (e) {
    const original = e instanceof Error ? e.message : String(e);
    const err = new Error(
      `no se pudo abrir la base de datos en '${opciones.dbPath}': ${original}`,
    );
    Object.defineProperty(err, 'cause', {
      value: {
        codigo: 'ERROR_PERSISTENCIA',
        dbPath: opciones.dbPath,
        original: e,
      },
      enumerable: true,
    });
    throw err;
  }
  ejecutarMigrations(db, migrations);
  const repository = crearLecturaRepositorySqlite(db);
  return {
    repository,
    cerrar: () => repository.cerrar(),
  };
}
