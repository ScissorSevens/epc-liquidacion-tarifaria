/**
 * Tests del adapter SQLite `crearColaSincronizacionSqlite`.
 *
 * Reusa el harness `runColaSincronizacionContract` para validar que el
 * adapter SQLite cumple EXACTAMENTE el mismo contrato que el in-memory
 * (15 tests). El cleanup `cerrar()` libera la conexion en cada test.
 *
 * Mismo patron que `lectura-repository-sqlite.test.ts` y
 * `factura-repository-sqlite.test.ts`.
 */

import { crearDBTest } from '../../persistencia/sqlite/__fixtures__/crear-db-test';
import { crearColaSincronizacionSqlite } from '../../persistencia/sqlite/cola-repository-sqlite';
import { runColaSincronizacionContract } from './cola-repository.contract';

runColaSincronizacionContract(
  'ColaSincronizacionSqlite',
  () => crearColaSincronizacionSqlite(crearDBTest()),
  (repo) => (repo as ReturnType<typeof crearColaSincronizacionSqlite>).cerrar(),
);
