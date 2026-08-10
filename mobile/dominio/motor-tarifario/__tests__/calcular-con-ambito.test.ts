/**
 * RED test para el wrapper `calcularLiquidacionConAmbito`.
 *
 * Wrapper que invoca `validarAmbito` antes de delegar a `calcularLiquidacion`.
 * Existe como capa separada (no toca la firma del motor puro) para
 * mantener backward-compat con los 40 callers legacy.
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (task 2.7 RED).
 */

import { calcularLiquidacionConAmbito } from '../calcular-con-ambito';
import {
  ACUERDO_BASE,
  entradaBase,
  PARAMETROS_BASE,
} from './fixtures-ambito';
// Fixtures inline (no existe archivo separado aún, los importo abajo si falla).

describe('calcularLiquidacionConAmbito — gate previo al motor', () => {
  const FECHA_EMISION = '2026-08-10T10:00:00Z';

  it('T-AMB-1: lanza error si prestador retorna NO_APLICA', () => {
    const prestadorNO_APLICA = {
      id_prestador: 99,
      cantidad_suscriptores: 12000,
      zona: 'URBANA' as const,
    };
    // NOTA: este prestador con >5000 URBANOS cae en Subtítulo 1
    // (norma CRA 1032/2026). El sistema actual (Subtítulo 2 con
    // metodología CRA 825) lo trata como NO_APLICA si no migró.
    // El test valida la integración de gate; el contenido de la
    // evaluación es responsabilidad de `validar-ambito.test.ts`.
    expect(() =>
      calcularLiquidacionConAmbito(
        { ...entradaBase({ id_prestador: 99 }), fecha_emision: FECHA_EMISION },
        { ...PARAMETROS_BASE, id_prestador: 99 },
        ACUERDO_BASE,
        prestadorNO_APLICA,
      ),
    ).toThrow(/AMBITO_NO_APLICA|fuera del ámbito/);
  });

  it('T-AMB-2: NO lanza si prestador retorna APLICA Subtítulo 2 (rural ≤5.000)', () => {
    const prestadorRural = {
      id_prestador: 1,
      cantidad_suscriptores: 1200,
      zona: 'RURAL' as const,
    };
    const r = calcularLiquidacionConAmbito(
      { ...entradaBase({ id_prestador: 1 }), fecha_emision: FECHA_EMISION },
      { ...PARAMETROS_BASE, id_prestador: 1 },
      ACUERDO_BASE,
      prestadorRural,
    );
    expect(r).toBeDefined();
  });

  it('T-AMB-3: lanza error si prestador retorna INDETERMINADO (sin datos de suscriptores)', () => {
    const prestadorIndeterminado = {
      id_prestador: 2,
      cantidad_suscriptores: null,
      zona: 'RURAL' as const,
    };
    expect(() =>
      calcularLiquidacionConAmbito(
        { ...entradaBase({ id_prestador: 2 }), fecha_emision: FECHA_EMISION },
        { ...PARAMETROS_BASE, id_prestador: 2 },
        ACUERDO_BASE,
        prestadorIndeterminado,
      ),
    ).toThrow(/AMBITO_INDETERMINADO|cantidad_suscriptores_indefinida/);
  });

  it('T-AMB-4: integra metadatos del ámbito en el resultado (futuro)', () => {
    // Placeholder para extender MetadataCalculo con `validacion_ambito`.
    // Por ahora solo verificamos que el resultado existe.
    const prestadorRural = {
      id_prestador: 3,
      cantidad_suscriptores: 800,
      zona: 'RURAL' as const,
    };
    const r = calcularLiquidacionConAmbito(
      { ...entradaBase({ id_prestador: 3 }), fecha_emision: FECHA_EMISION },
      { ...PARAMETROS_BASE, id_prestador: 3 },
      ACUERDO_BASE,
      prestadorRural,
    );
    expect(r).toBeDefined();
  });
});
