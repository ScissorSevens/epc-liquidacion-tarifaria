/**
 * Tests de `validarCmogMinimo` — Res CRA 825/2017 Art. 18 (CMOG mínimo).
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (fase 2, task 2.5 RED).
 * Cubre los 2 escenarios del spec:
 *   - CMOG < $467/m³ acueducto → throws CMOG_BAJO_MINIMO
 *   - CMOG < $169/m³ alcantarillado → throws CMOG_BAJO_MINIMO
 *
 * Por qué `throw` y no `ValidacionError`: misma convención que
 * `validarCmaMinimo`. Las validaciones regulatorias son invariantes
 * rotas — fallar ruidosamente es lo correcto.
 */

import {
  CMOG_MINIMO_ACUEDUCTO,
  CMOG_MINIMO_ALCANTARILLADO,
  type Servicio,
} from '../validaciones';

// Importamos la función DESPUÉS de declarar `Servicio`. Como todavía
// NO EXISTE, este test RED fallará en el resolver de Jest hasta que la
// implementación se entregue.
import { validarCmogMinimo } from '../validaciones';

describe('validarCmogMinimo', () => {
  it('T-CMOG-1: throws CMOG_BAJO_MINIMO si cmo < mínimo acueducto ($467/m³)', () => {
    expect(() => validarCmogMinimo(400, 'acueducto')).toThrow(/CMOG_BAJO_MINIMO/);
  });

  it('T-CMOG-2: no throws si cmo = mínimo acueducto ($467)', () => {
    expect(() => validarCmogMinimo(CMOG_MINIMO_ACUEDUCTO, 'acueducto')).not.toThrow();
  });

  it('T-CMOG-3: throws CMOG_BAJO_MINIMO si cmo < mínimo alcantarillado ($169/m³)', () => {
    expect(() => validarCmogMinimo(100, 'alcantarillado')).toThrow(/CMOG_BAJO_MINIMO/);
  });

  it('T-CMOG-4: no throws si cmo = mínimo alcantarillado ($169)', () => {
    expect(() => validarCmogMinimo(CMOG_MINIMO_ALCANTARILLADO, 'alcantarillado')).not.toThrow();
  });

  it('T-CMOG-5 (triangulación): cmo sobre mínimo = no throw en ambos servicios', () => {
    expect(() => validarCmogMinimo(1000, 'acueducto')).not.toThrow();
    expect(() => validarCmogMinimo(1000, 'alcantarillado')).not.toThrow();
  });

  it('T-CMOG-6 (constantes): CMOG_MINIMO_ACUEDUCTO = 467 y CMOG_MINIMO_ALCANTARILLADO = 169', () => {
    expect(CMOG_MINIMO_ACUEDUCTO).toBe(467);
    expect(CMOG_MINIMO_ALCANTARILLADO).toBe(169);
  });

  it('T-CMOG-7 (tipo): Servicio es union literal "acueducto" | "alcantarillado"', () => {
    const a: Servicio = 'acueducto';
    const b: Servicio = 'alcantarillado';
    expect([a, b]).toEqual(['acueducto', 'alcantarillado']);
  });
});
