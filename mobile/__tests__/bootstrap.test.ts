// mobile/__tests__/bootstrap.test.ts
//
// Test de wiring del dominio puro: confirma que el path mapping
// `@dominio/*` funciona desde mobile/ y que el motor tarifario corre
// extremo a extremo en Node.
//
// Este test corre con el jest del root (ts-jest, env node), NO en RN.
// El bootstrap REAL (`bootstrap.ts`) usa expo-sqlite y solo se puede
// invocar en runtime movil; la cobertura contractual de los repos
// SQLite vive en sus espejos Node (`src/persistencia/sqlite/*`).

import { smokeDominio } from '../src/composition/smoke-dominio';

describe('wiring dominio movil', () => {
  it('importa el dominio y corre un smoke del motor tarifario', () => {
    const resultado = smokeDominio();

    expect(resultado.estado).toBe('OK');
    expect(resultado.mensaje).toContain('AquaServices');
    expect(typeof resultado.timestamp).toBe('string');
    expect(resultado.smokeMotorTarifario).toBeDefined();
    // Consumo = lecturaActual(1015) - lecturaAnterior(1000) = 15 m3
    expect(resultado.smokeMotorTarifario?.consumoM3).toBe(15);
    // Total > 0 confirma que el calculo se ejecuto end-to-end
    expect(resultado.smokeMotorTarifario?.totalCalculado).toBeGreaterThan(0);
  });

  it('devuelve un objeto JSON-serializable (para Alert.alert en RN)', () => {
    const resultado = smokeDominio();
    expect(() => JSON.stringify(resultado)).not.toThrow();
  });
});
