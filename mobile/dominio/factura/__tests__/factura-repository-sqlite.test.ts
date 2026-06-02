/**
 * Tests del adapter SQLite `crearFacturaRepositorySqlite`.
 *
 * Phase 7 Batch 4 (persistencia-sqlite): invoca el harness contract
 * adapter-agnostic `runFacturaRepositoryContract`. Mismos 14 scenarios
 * que el adapter in-memory deben pasar contra una `:memory:` SQLite real.
 *
 * `cleanupRepo` libera el handle SQLite via `repo.cerrar()`.
 */

import { runFacturaRepositoryContract } from './factura-repository-contract';
import { crearDBTest } from '../../persistencia/sqlite/__fixtures__/crear-db-test';
import {
  crearFacturaRepositorySqlite,
  type FacturaRepositorySqlite,
} from '../factura-repository-sqlite';

runFacturaRepositoryContract(
  'FacturaRepositorySqlite',
  () => crearFacturaRepositorySqlite(crearDBTest()),
  (repo) => (repo as FacturaRepositorySqlite).cerrar(),
);
