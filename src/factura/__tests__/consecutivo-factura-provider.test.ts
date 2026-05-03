/**
 * Tests del helper ConsecutivoFacturaProviderInMemory (fixture de tests).
 * Productivo (SQLite) vive en Iter 7 — design D3-a.
 */

import { crearConsecutivoFacturaProviderInMemory } from './consecutivo-factura-provider-in-memory';

describe('ConsecutivoFacturaProviderInMemory — primer call por dispositivo', () => {
  it('retorna 1 la primera vez que se invoca proximo para un dispositivo', async () => {
    const provider = crearConsecutivoFacturaProviderInMemory();
    const consecutivo = await provider.proximo('MZ-001');
    expect(consecutivo).toBe(1);
  });
});

describe('ConsecutivoFacturaProviderInMemory — calls consecutivos por dispositivo', () => {
  it('incrementa monotonicamente: 1, 2, 3 en calls sucesivos al mismo dispositivo', async () => {
    const provider = crearConsecutivoFacturaProviderInMemory();
    const a = await provider.proximo('MZ-001');
    const b = await provider.proximo('MZ-001');
    const c = await provider.proximo('MZ-001');
    expect([a, b, c]).toEqual([1, 2, 3]);
  });
});
