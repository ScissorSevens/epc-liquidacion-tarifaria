/**
 * Bootstrap del módulo factura con backend SQLite.
 *
 * Punto de entrada cableado que: abre conexión SQLite con `dbPath`
 * configurable, ejecuta migraciones pendientes idempotentemente, y
 * devuelve el `FacturaRepository` listo para usar junto con una función
 * de cierre limpio.
 *
 * Hexagonal: este módulo es composition root de infra. NO contiene
 * lógica de dominio; solo cablea adapter (`crearFacturaRepositorySqlite`)
 * con infra (`crearConexion`, `ejecutarMigrations`).
 */

import { crearConexion } from '../persistencia/sqlite/db';
import { ejecutarMigrations } from '../persistencia/sqlite/migration-runner';
import { migrations } from '../persistencia/sqlite/migrations';
import { crearFacturaRepositorySqlite } from './factura-repository-sqlite';
import type { FacturaRepository } from './types';

export interface BootstrapFacturaSqliteOpciones {
  readonly dbPath: string;
}

export interface BootstrapFacturaSqlite {
  readonly repository: FacturaRepository;
  readonly cerrar: () => void;
}

/**
 * Cablea el módulo factura con SQLite.
 *
 * Lifecycle: el caller es responsable de invocar `cerrar()` cuando
 * termina (típicamente al apagar el proceso).
 *
 * Errores: si `dbPath` no se puede abrir (directorio padre inexistente,
 * permisos, etc.), lanza un `Error` con mensaje de dominio en español
 * y `cause.codigo = 'ERROR_PERSISTENCIA'` para que el caller pueda
 * distinguirlo de errores genéricos. El error original queda en
 * `cause.original` para diagnóstico.
 */
export function crearBootstrapFacturaSqlite(
  opciones: BootstrapFacturaSqliteOpciones,
): BootstrapFacturaSqlite {
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
  const repository = crearFacturaRepositorySqlite(db);
  return {
    repository,
    cerrar: () => repository.cerrar(),
  };
}
