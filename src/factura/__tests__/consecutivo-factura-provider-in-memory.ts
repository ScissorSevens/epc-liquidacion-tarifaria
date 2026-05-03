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
  const counters = new Map<string, number>();

  return {
    async proximo(dispositivoId: string): Promise<number> {
      const actual = counters.get(dispositivoId) ?? 0;
      const siguiente = actual + 1;
      counters.set(dispositivoId, siguiente);
      return siguiente;
    },
  };
}
