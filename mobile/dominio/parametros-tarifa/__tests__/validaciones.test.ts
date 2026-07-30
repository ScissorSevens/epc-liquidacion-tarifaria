/**
 * Tests de `validarCmaMinimo` — Res CRA 825/2017 Art. 15 (CMA mínimo).
 *
 * Cambia `param-tarifa-res-825-compliance-phase1` (fase 1). Cubre los
 * 3 escenarios del delta spec:
 *   - CMA bajo mínimo de acueducto (>= 2890) → error
 *   - CMA exactamente en mínimo de acueducto → no throw
 *   - CMA bajo mínimo de alcantarillado (>= 2069) → error
 *
 * Por que `THROW` y no `ValidacionError`: la funcion es PUBLICA y
 * PURA; lanza un Error de JS nativo con la clave de MENSAJES_ERROR
 * embebida en el `.message`. Tests verifican via `toThrow(/CMA_BAJO_MINIMO/)`
 * para no acoplar al tipo de error, solo a la presencia de la clave.
 */

import {
  validarCmaMinimo,
  CMA_MINIMO_ACUEDUCTO,
  CMA_MINIMO_ALCANTARILLADO,
  type Servicio,
} from '../validaciones';

describe('validarCmaMinimo', () => {
  it('T-CMA-1: throws CMA_BAJO_MINIMO si cma < mínimo acueducto', () => {
    expect(() => validarCmaMinimo(2000, 'acueducto')).toThrow(/CMA_BAJO_MINIMO/);
  });

  it('T-CMA-2: no throws si cma = mínimo acueducto (2890)', () => {
    expect(() => validarCmaMinimo(CMA_MINIMO_ACUEDUCTO, 'acueducto')).not.toThrow();
  });

  it('T-CMA-3: throws CMA_BAJO_MINIMO si cma < mínimo alcantarillado', () => {
    expect(() => validarCmaMinimo(1500, 'alcantarillado')).toThrow(/CMA_BAJO_MINIMO/);
  });

  it('T-CMA-4 (triangulación): cma exactamente en mínimo alcantarillado = no throw', () => {
    expect(() => validarCmaMinimo(CMA_MINIMO_ALCANTARILLADO, 'alcantarillado')).not.toThrow();
  });

  it('T-CMA-5 (triangulación): cma sobre mínimo = no throw en ambos servicios', () => {
    expect(() => validarCmaMinimo(5000, 'acueducto')).not.toThrow();
    expect(() => validarCmaMinimo(5000, 'alcantarillado')).not.toThrow();
  });

  it('T-CMA-6 (constantes): CMA_MINIMO_ACUEDUCTO = 2890 y CMA_MINIMO_ALCANTARILLADO = 2069', () => {
    expect(CMA_MINIMO_ACUEDUCTO).toBe(2890);
    expect(CMA_MINIMO_ALCANTARILLADO).toBe(2069);
  });

  it('T-CMA-7 (tipo): Servicio es union literal "acueducto" | "alcantarillado"', () => {
    // Si el union cambia, este cast falla en tsc --noEmit.
    const a: Servicio = 'acueducto';
    const b: Servicio = 'alcantarillado';
    expect([a, b]).toEqual(['acueducto', 'alcantarillado']);
  });
});
