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
  const store = new Map<string, Factura>();

  return {
    async crear(factura: Factura): Promise<Factura> {
      store.set(factura.id, factura);
      return factura;
    },
    async buscarPorId(id: string): Promise<Factura | null> {
      return store.get(id) ?? null;
    },
    async buscarPorPeriodo(idPeriodo: string): Promise<readonly Factura[]> {
      return Array.from(store.values()).filter(
        (f) => f.snapshot.periodo.id_periodo === idPeriodo,
      );
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
