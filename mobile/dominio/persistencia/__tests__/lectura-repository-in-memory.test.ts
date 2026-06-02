/**
 * Tests del adapter in-memory `LecturaRepositoryMemoria`.
 *
 * La bateria completa vive en `lectura-repository-contract.ts` (harness
 * reusable adapter-agnostic). Este file solo invoca el contract pasando
 * el factory del adapter in-memory. El adapter SQLite usa el mismo harness.
 */

import { LecturaRepositoryMemoria } from '../lectura-repository-memoria';
import { runLecturaRepositoryContract } from './lectura-repository-contract';

runLecturaRepositoryContract('LecturaRepositoryMemoria', () => new LecturaRepositoryMemoria());
