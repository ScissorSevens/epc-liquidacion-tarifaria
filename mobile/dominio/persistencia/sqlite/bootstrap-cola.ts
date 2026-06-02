/**
 * Bootstrap del modulo persistencia de la cola de sincronizacion con
 * backend SQLite.
 *
 * Resuelve la BOMBA OFFLINE-FIRST #1: la cola sobrevive cierres del
 * proceso. Antes de este modulo, `InMemoryColaSincronizacion` perdia
 * todos los items pendientes al apagar la app.
 *
 * Punto de entrada cableado que: abre conexion SQLite con `dbPath`
 * configurable, ejecuta migraciones pendientes idempotentemente, y
 * devuelve el `ColaSincronizacion` listo para usar junto con una
 * funcion de cierre limpio.
 *
 * Hexagonal: este modulo es composition root de infra. NO contiene
 * logica de dominio; solo cablea adapter (`crearColaSincronizacionSqlite`)
 * con infra (`crearConexion`, `ejecutarMigrations`).
 *
 * Espejo intencional de `bootstrap-lectura.ts` y `src/factura/bootstrap.ts`.
 * Si el patron evoluciona (ej. inyeccion de logger), tocar TODOS para
 * mantener consistencia.
 */

import { crearConexion } from './db';
import { ejecutarMigrations } from './migration-runner';
import { migrations } from './migrations';
import { crearColaSincronizacionSqlite } from './cola-repository-sqlite';
import type { ColaSincronizacion } from '../../sincronizacion/cola-repository';

export interface BootstrapColaSqliteOpciones {
  readonly dbPath: string;
}

export interface BootstrapColaSqlite {
  readonly repository: ColaSincronizacion;
  readonly cerrar: () => void;
}

/**
 * Cablea el modulo de persistencia de la cola con SQLite.
 *
 * Lifecycle: el caller es responsable de invocar `cerrar()` cuando
 * termina (tipicamente al apagar el proceso).
 *
 * Errores: si `dbPath` no se puede abrir (directorio padre inexistente,
 * permisos, etc.), lanza un `Error` con mensaje de dominio en espaniol
 * y `cause.codigo = 'ERROR_PERSISTENCIA'` para que el caller pueda
 * distinguirlo de errores genericos.
 */
export function crearBootstrapColaSqlite(
  opciones: BootstrapColaSqliteOpciones,
): BootstrapColaSqlite {
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
  const repository = crearColaSincronizacionSqlite(db);
  return {
    repository,
    cerrar: () => repository.cerrar(),
  };
}
