/**
 * Tests del adapter in-memory `crearFacturaRepositoryInMemory`.
 *
 * Phase 6 Batch 3: la batería completa vive en `factura-repository-contract.ts`
 * (harness reusable adapter-agnostic). Este file solo invoca el contract
 * pasando el factory del adapter in-memory. Cualquier adapter futuro
 * (SQLite en Batch 4) usará el mismo harness.
 */

import { crearFacturaRepositoryInMemory } from './factura-repository-in-memory';
import { runFacturaRepositoryContract } from './factura-repository-contract';

runFacturaRepositoryContract('FacturaRepositoryInMemory', () =>
  crearFacturaRepositoryInMemory(),
);
