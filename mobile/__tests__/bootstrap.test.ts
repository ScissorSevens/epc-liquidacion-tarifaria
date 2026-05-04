// mobile/__tests__/bootstrap.test.ts
//
// Test de wiring: confirma que el bootstrap movil importa el dominio
// (motor-tarifario puro) sin romper, y devuelve un objeto OK con el
// smoke del calculador.
//
// Este test corre con el jest del root (ts-jest, env node), NO en RN.
// No exercita ningun adapter SQLite ni APIs nativas — solo el dominio puro.

import { bootstrapApp } from '../src/composition/bootstrap';

describe('bootstrap movil', () => {
  it('importa el dominio y corre un smoke del motor tarifario', () => {
    const resultado = bootstrapApp();

    expect(resultado.estado).toBe('OK');
    expect(resultado.mensaje).toContain('MediApp');
    expect(typeof resultado.timestamp).toBe('string');
    expect(resultado.smokeMotorTarifario).toBeDefined();
    // Consumo = lecturaActual(1015) - lecturaAnterior(1000) = 15 m3
    expect(resultado.smokeMotorTarifario?.consumoM3).toBe(15);
    // Total > 0 confirma que el calculo se ejecuto end-to-end
    expect(resultado.smokeMotorTarifario?.totalCalculado).toBeGreaterThan(0);
  });

  it('devuelve un objeto JSON-serializable (para Alert.alert en RN)', () => {
    const resultado = bootstrapApp();
    expect(() => JSON.stringify(resultado)).not.toThrow();
  });
});
