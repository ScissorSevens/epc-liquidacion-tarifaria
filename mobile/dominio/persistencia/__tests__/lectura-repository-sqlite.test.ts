/**
 * Tests del adapter SQLite `crearLecturaRepositorySqlite`.
 *
 * Invoca el harness contract adapter-agnostic `runLecturaRepositoryContract`.
 * Mismos scenarios que el adapter in-memory deben pasar contra una `:memory:`
 * SQLite real con la migration 002_lectura aplicada.
 *
 * `cleanupRepo` libera el handle SQLite via `repo.cerrar()`.
 */

import { runLecturaRepositoryContract } from './lectura-repository-contract';
import { crearDBTest } from '../sqlite/__fixtures__/crear-db-test';
import {
  crearLecturaRepositorySqlite,
  type LecturaRepositorySqlite,
} from '../sqlite/lectura-repository-sqlite';

runLecturaRepositoryContract(
  'LecturaRepositorySqlite',
  () => crearLecturaRepositorySqlite(crearDBTest()),
  (repo) => (repo as LecturaRepositorySqlite).cerrar(),
);
