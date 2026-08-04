/**
 * Tests de la tabla IPC y de `calcularFactorIpc` — Res CRA 825 Art. 11.
 *
 * Cambia `param-tarifa-res-825-compliance-phase1` (fase 1). Cubre los
 * 4 escenarios del delta spec:
 *   - Factor IPC 2016→2026 ≈ 1.6234
 *   - Tabla IPC_VALORES tiene 2016, 2020, 2026
 *   - Mismo año retorna 1.0
 *   - Año destino desconocido retorna 1.0 (fallback conservador)
 *
 * Importante: la `IPC_VALORES` tabla es una APROXIMACIÓN de los
 * valores oficiales DANE. No es el dato oficial — la fase 2 la
 * convierte en serie reemplazable. La pureza de la función
 * (factor = ipc_destino / ipc_base) sigue siendo la misma.
 */

import { calcularFactorIpc, IPC_VALORES } from '../ipc';

describe('IPC_VALORES — tabla inmutable 2016-2026', () => {
  it('T-IPC-1: retorna ~1.6234 para 2016→2026', () => {
    expect(calcularFactorIpc(2016, 2026)).toBeCloseTo(1.6234, 2);
  });

  it('T-IPC-2: tabla IPC_VALORES tiene 2016, 2020, 2026', () => {
    expect(IPC_VALORES[2016]).toBe(1.0);
    expect(IPC_VALORES[2020]).toBeDefined();
    expect(IPC_VALORES[2026]).toBeDefined();
  });

  it('T-IPC-3: retorna 1.0 mismo año', () => {
    expect(calcularFactorIpc(2016, 2016)).toBe(1.0);
    expect(calcularFactorIpc(2020, 2020)).toBe(1.0);
  });

  it('T-IPC-4: fallback 1.0 si año destino desconocido', () => {
    expect(calcularFactorIpc(2016, 9999)).toBe(1.0);
  });

  it('T-IPC-5 (triangulación): fallback 1.0 si año base desconocido', () => {
    expect(calcularFactorIpc(9999, 2026)).toBe(1.0);
  });

  it('T-IPC-6 (triangulación): factor 2016→2020 mayor a 1.0 (acumulación oficial)', () => {
    expect(calcularFactorIpc(2016, 2020)).toBeGreaterThan(1.0);
  });

  it('T-IPC-7 (inversión): factor 2020→2016 = 1 / factor 2016→2020 (consistencia)', () => {
    const fwd = calcularFactorIpc(2016, 2020);
    const bwd = calcularFactorIpc(2020, 2016);
    expect(bwd).toBeCloseTo(1 / fwd, 5);
  });

  it('T-IPC-8 (constantes): IPC_VALORES es readonly (Object.freeze)', () => {
    // El contrato verificable es que IPC_VALORES es inmutable en runtime:
    // cualquier intento de asignar a una propiedad NO debe alterar el valor.
    // El mecanismo por el cual el runtime enforce esto depende del modo:
    //   - TS strict mode (modulos .ts compilados con strict:true) lanza
    //     TypeError ante la asignacion a un objeto frozen.
    //   - sloppy mode (Babel sin strict, p.ej. jest-expo) ignora la
    //     asignacion silenciosamente — la linea no-op no produce efecto.
    // Ambos modos son validos; lo que importa es el resultado observable.
    const valorOriginal = IPC_VALORES[2025];
    try {
      (IPC_VALORES as Record<number, number>)[2025] = 99;
    } catch {
      // strict mode tiro TypeError — esperado, contrato cumplido.
    }
    // El valor sigue siendo el original — el freeze impidio la asignacion.
    expect(IPC_VALORES[2025]).toBe(valorOriginal);
  });
});
