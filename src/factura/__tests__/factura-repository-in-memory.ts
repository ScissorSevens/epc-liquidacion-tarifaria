/**
 * Helper de testing: implementación in-memory de `FacturaRepository`.
 *
 * NO se exporta en `src/factura/index.ts` — es fixture de tests.
 * Implementación productiva (SQLite) vive en Iter 7. Este helper sirve
 * para tests de orquestadores `*ConRepo` y para tests futuros de
 * integración entre módulos.
 *
 * Patrón: factory function con closures sobre `Map<string, Factura>`
 * (sin classes, alineado con convención del proyecto).
 */

import type { Factura, FacturaRepository } from '../types';

export function crearFacturaRepositoryInMemory(): FacturaRepository {
  return {
    async crear(_factura: Factura): Promise<Factura> {
      throw new Error('not implemented');
    },
    async buscarPorId(_id: string): Promise<Factura | null> {
      throw new Error('not implemented');
    },
    async buscarPorPeriodo(_idPeriodo: string): Promise<readonly Factura[]> {
      throw new Error('not implemented');
    },
    async buscarPorSuscriptor(_idSuscriptor: number): Promise<readonly Factura[]> {
      throw new Error('not implemented');
    },
    async actualizar(_id, _cambios): Promise<Factura> {
      throw new Error('not implemented');
    },
    async listar(): Promise<readonly Factura[]> {
      throw new Error('not implemented');
    },
  };
}
