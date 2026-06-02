/**
 * Bootstrap COMPLETO del backend SQLite del sistema.
 *
 * Composition root unico que abre UNA conexion SQLite, corre TODAS las
 * migrations en orden, y devuelve los 5 repos cableados + Hasher +
 * IdGenerator + cerrar() limpio.
 *
 * Por que un bootstrap unico (vs los 3 individuales que ya existen):
 *  - El flujo de importacion CSV necesita suscriptor + medidor en la
 *    MISMA DB (FK cross-table). Los bootstraps por modulo abren cada
 *    uno su propia conexion, lo que rompe FK y duplica esfuerzo.
 *  - Mobile y Node necesitan punto de entrada unico al apagar la app.
 *
 * Hexagonal: composition root puro, sin logica de dominio. Los
 * bootstraps individuales (`bootstrap-cola.ts`, `bootstrap-lectura.ts`,
 * `factura/bootstrap.ts`) se mantienen por retrocompatibilidad de
 * tests existentes; en la app real se usa solo este.
 *
 * PRAGMA foreign_keys=ON: lo aplica `crearConexion` automaticamente.
 * CRITICO para que la FK medidor.id_suscriptor -> suscriptor funcione.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { crearConexion } from '../persistencia/sqlite/db';
import { ejecutarMigrations } from '../persistencia/sqlite/migration-runner';
import { migrations } from '../persistencia/sqlite/migrations';
import { crearFacturaRepositorySqlite } from '../factura/factura-repository-sqlite';
import { crearLecturaRepositorySqlite } from '../persistencia/sqlite/lectura-repository-sqlite';
import { crearColaSincronizacionSqlite } from '../persistencia/sqlite/cola-repository-sqlite';
import { crearSuscriptorRepositorySqlite } from '../persistencia/sqlite/suscriptor-repository-sqlite';
import { crearMedidorRepositorySqlite } from '../persistencia/sqlite/medidor-repository-sqlite';
import { crearHasherJs } from '../shared/adapters/hasher-js';
import { crearIdGeneratorUuid } from '../shared/adapters/id-generator-uuid';
import type { FacturaRepository } from '../factura/types';
import type { LecturaRepository } from '../persistencia/lectura-repository';
import type { ColaSincronizacion } from '../sincronizacion/cola-repository';
import type { SuscriptorRepository } from '../suscriptores';
import type { MedidorRepository } from '../medidores';
import type { Hasher } from '../shared/ports/hasher';
import type { IdGenerator } from '../shared/ports/id-generator';

export interface SistemaCompleto {
  readonly facturaRepo: FacturaRepository;
  readonly lecturaRepo: LecturaRepository;
  readonly colaRepo: ColaSincronizacion;
  readonly suscriptorRepo: SuscriptorRepository;
  readonly medidorRepo: MedidorRepository;
  readonly hasher: Hasher;
  readonly idGen: IdGenerator;
  readonly cerrar: () => void;
}

/**
 * Cablea el backend SQLite completo.
 *
 * Lifecycle: el caller debe invocar `cerrar()` al apagar el proceso.
 * Cierra la conexion SQLite (los repos comparten la misma `db`, asi
 * que no hay que cerrarlos individualmente).
 *
 * Errores: si `dbPath` no se puede abrir, lanza Error con
 * `cause.codigo='ERROR_PERSISTENCIA'`.
 */
export function bootstrapCompleto(rutaDb: string): SistemaCompleto {
  let db: DatabaseType;
  try {
    db = crearConexion(rutaDb);
  } catch (e) {
    const original = e instanceof Error ? e.message : String(e);
    const err = new Error(
      `no se pudo abrir la base de datos en '${rutaDb}': ${original}`,
    );
    Object.defineProperty(err, 'cause', {
      value: { codigo: 'ERROR_PERSISTENCIA', dbPath: rutaDb, original: e },
      enumerable: true,
    });
    throw err;
  }

  ejecutarMigrations(db, migrations);

  const facturaRepo = crearFacturaRepositorySqlite(db);
  const lecturaRepo = crearLecturaRepositorySqlite(db);
  const colaRepo = crearColaSincronizacionSqlite(db);
  const suscriptorRepo = crearSuscriptorRepositorySqlite(db);
  const medidorRepo = crearMedidorRepositorySqlite(db);

  return {
    facturaRepo,
    lecturaRepo,
    colaRepo,
    suscriptorRepo,
    medidorRepo,
    hasher: crearHasherJs(),
    idGen: crearIdGeneratorUuid(),
    // Una sola conexion compartida: cerramos la DB directo, no cada repo
    // (los `cerrar()` de los adapters individuales tambien cerrarian la
    // misma db; cualquiera funciona, este es el mas explicito).
    cerrar: () => db.close(),
  };
}
