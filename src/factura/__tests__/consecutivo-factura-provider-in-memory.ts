/**
 * Helper de testing: implementación in-memory de `ConsecutivoFacturaProvider`.
 *
 * NO se exporta en `src/factura/index.ts` — es fixture de tests.
 * Implementación productiva (SQLite) vive en Iter 7 (design D3-a):
 *   `INSERT ... ON CONFLICT UPDATE ultimo = ultimo + 1 RETURNING ultimo` (atomic).
 *
 * Patrón: factory function con closures sobre `Map<string, number>` por device.
 * Counter inicia en 0, primer `proximo()` retorna 1.
 */

import type { ConsecutivoFacturaProvider } from '../types';

export function crearConsecutivoFacturaProviderInMemory(): ConsecutivoFacturaProvider {
  // counters: declarado pero no usado aun — los cycles 7.1-7.3 lo poblaran.
  // Anotacion `_unused` para evitar warning de variable sin uso.
  const _counters = new Map<string, number>();
  void _counters;

  return {
    async proximo(_dispositivoId: string): Promise<number> {
      throw new Error('not implemented');
    },
  };
}
