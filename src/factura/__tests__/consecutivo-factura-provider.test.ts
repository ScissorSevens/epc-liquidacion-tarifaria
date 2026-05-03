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

describe('ConsecutivoFacturaProviderInMemory — counters independientes por dispositivo', () => {
  it('mantiene secuencia separada por dispositivo: dispositivos distintos no comparten counter', async () => {
    const provider = crearConsecutivoFacturaProviderInMemory();
    // Avanzar MZ-001 a 3
    await provider.proximo('MZ-001');
    await provider.proximo('MZ-001');
    await provider.proximo('MZ-001');
    // MZ-002 debe arrancar desde 1 (no continuar desde 4)
    const primeroMZ002 = await provider.proximo('MZ-002');
    const segundoMZ002 = await provider.proximo('MZ-002');
    // Mientras MZ-001 sigue en su secuencia
    const cuartoMZ001 = await provider.proximo('MZ-001');

    expect(primeroMZ002).toBe(1);
    expect(segundoMZ002).toBe(2);
    expect(cuartoMZ001).toBe(4);
  });
});
