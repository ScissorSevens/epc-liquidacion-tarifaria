/**
 * Tests del adapter in-memory `InMemoryColaSincronizacion`.
 *
 * La bateria completa vive en `cola-repository.contract.ts` (harness
 * reusable adapter-agnostic). Este file solo invoca el contract pasando
 * el factory del adapter in-memory. El adapter SQLite usa el mismo harness.
 */

import { InMemoryColaSincronizacion } from '../cola-repository';
import { runColaSincronizacionContract } from './cola-repository.contract';

runColaSincronizacionContract(
  'InMemoryColaSincronizacion',
  () => new InMemoryColaSincronizacion(),
);
