// Composition root real para la app movil.
//
// Cablea las repos SQLite (factura, lectura, cola) sobre `expo-sqlite`,
// aplicando las migraciones idempotentemente al arrancar.
//
// Esta funcion es ASYNC y depende de modulos nativos de RN — solo se
// puede invocar desde el runtime movil. El wiring test del root valida
// `smokeDominio()` por separado en `smoke-dominio.ts`, que NO importa
// expo-sqlite y por eso es Node-importable.

// IMPORTANTE: el polyfill de crypto.getRandomValues debe importarse ANTES
// que cualquier modulo que use uuid v4. RN/Hermes no expone Web Crypto API
// nativamente y `uuid` falla silenciosamente sin esto.
import 'react-native-get-random-values';

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
import {
  crearSuscriptorRepositoryExpoSqlite,
  type SuscriptorRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/suscriptor-repository-expo-sqlite';
import {
  crearMedidorRepositoryExpoSqlite,
  type MedidorRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/medidor-repository-expo-sqlite';
import { crearHasherJs } from '@dominio/shared/adapters/hasher-js';
import { crearIdGeneratorUuid } from '@dominio/shared/adapters/id-generator-uuid';
import type { Hasher, IdGenerator } from '@dominio/shared/ports';
import { smokeDominio, type ResultadoSmokeDominio } from './smoke-dominio';

export const NOMBRE_DB_MOVIL = 'mediapp.db';

export interface BootstrapApp {
  readonly db: SQLite.SQLiteDatabase;
  readonly facturaRepo: FacturaRepositoryExpoSqlite;
  readonly lecturaRepo: LecturaRepositoryExpoSqlite;
  readonly colaRepo: ColaRepositoryExpoSqlite;
  // Catalogo de suscriptores y sus medidores. Nombres en linea con
  // `bootstrap-completo.ts` del root para coherencia entre Node y mobile.
  readonly suscriptorRepo: SuscriptorRepositoryExpoSqlite;
  readonly medidorRepo: MedidorRepositoryExpoSqlite;
  readonly hasher: Hasher;
  readonly idGenerator: IdGenerator;
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
  const suscriptorRepo = crearSuscriptorRepositoryExpoSqlite(db);
  const medidorRepo = crearMedidorRepositoryExpoSqlite(db);

  // Adapters universales del dominio: js-sha256 y uuid v4 (con polyfill
  // de crypto.getRandomValues importado al tope del archivo). Cualquier
  // caso de uso del dominio que necesite hash o id debe recibir estos
  // mismos singletons via inyeccion de parametros.
  const hasher = crearHasherJs();
  const idGenerator = crearIdGeneratorUuid();

  const smoke = smokeDominio();

  return {
    db,
    facturaRepo,
    lecturaRepo,
    colaRepo,
    suscriptorRepo,
    medidorRepo,
    hasher,
    idGenerator,
    smoke,
  };
}
