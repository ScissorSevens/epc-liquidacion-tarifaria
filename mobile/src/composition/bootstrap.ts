// Composition root real para la app movil.
//
// Cablea las repos SQLite (factura, lectura, cola) sobre `expo-sqlite`,
// aplicando las migraciones idempotentemente al arrancar.
//
// Esta funcion es ASYNC y depende de modulos nativos de RN — solo se
// puede invocar desde el runtime movil. El wiring test del root valida
// `smokeDominio()` por separado en `smoke-dominio.ts`, que NO importa
// expo-sqlite y por eso es Node-importable.

import * as SQLite from 'expo-sqlite';
import { aplicarMigracionesAsync } from '../persistencia/expo-sqlite/migraciones';
import {
  crearFacturaRepositoryExpoSqlite,
  type FacturaRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/factura-repository-expo-sqlite';
import {
  crearLecturaRepositoryExpoSqlite,
  type LecturaRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/lectura-repository-expo-sqlite';
import {
  crearColaRepositoryExpoSqlite,
  type ColaRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/cola-repository-expo-sqlite';
import { smokeDominio, type ResultadoSmokeDominio } from './smoke-dominio';

export const NOMBRE_DB_MOVIL = 'mediapp.db';

export interface BootstrapApp {
  readonly db: SQLite.SQLiteDatabase;
  readonly facturaRepo: FacturaRepositoryExpoSqlite;
  readonly lecturaRepo: LecturaRepositoryExpoSqlite;
  readonly colaRepo: ColaRepositoryExpoSqlite;
  readonly smoke: ResultadoSmokeDominio;
}

/**
 * Abre la DB SQLite local, aplica migraciones pendientes y devuelve los
 * repos cableados con la conexion. Tambien corre el smoke del dominio
 * (motor tarifario puro) por sanidad.
 *
 * Lifecycle: el caller es responsable de cerrar la conexion (a traves
 * de cualquiera de los `*.cerrar()` o `db.closeAsync()`) cuando termina.
 * En la practica el celular cierra la app y la DB queda persistida en
 * disco.
 */
export async function bootstrapApp(): Promise<BootstrapApp> {
  const db = await SQLite.openDatabaseAsync(NOMBRE_DB_MOVIL);
  await aplicarMigracionesAsync(db);

  const facturaRepo = crearFacturaRepositoryExpoSqlite(db);
  const lecturaRepo = crearLecturaRepositoryExpoSqlite(db);
  const colaRepo = crearColaRepositoryExpoSqlite(db);

  const smoke = smokeDominio();

  return { db, facturaRepo, lecturaRepo, colaRepo, smoke };
}
