/**
 * RED test para el gate `acuerdo.estado` en `calcularLiquidacion`.
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (task 2.9 RED).
 *
 * Decisión arquitectónica:
 *   - Acuerdo.estado 'BORRADOR'|'VENCIDO'|'DEROGADO' → throw ACUERDO_NO_ACTIVO
 *   - Acuerdo.estado 'ACTIVO' → aplica factores normalmente
 *   - Acuerdo.estado undefined (legacy data pre-fase 2) → skip del check (backward-compat)
 *   - acuerdo = null (caso legacy) → usa topes L142 directamente (caller decide)
 *
 * Backward-compat principle: 40 callers legacy del motor no setean
 * `estado`. Si el check fuera throw-everytime cuando `estado != 'ACTIVO'`,
 * rompería toda la base. Por eso el check solo aplica si `estado`
 * está EXPLÍCITAMENTE definido.
 */

import { calcularLiquidacion } from '../motor-tarifario';
import { ACUERDO_BASE, entradaBase, PARAMETROS_BASE } from './fixtures-ambito';

describe('calcularLiquidacion — gate acuerdo.estado (task 2.9 RED)', () => {
  it('T-ACUERDO-1: con Acuerdo BORRADOR lanza ACUERDO_NO_ACTIVO', () => {
    const acuerdoBORRADOR = { ...ACUERDO_BASE, estado: 'BORRADOR' as const };
    expect(() =>
      calcularLiquidacion(entradaBase(), PARAMETROS_BASE, acuerdoBORRADOR),
    ).toThrow(/ACUERDO_NO_ACTIVO/);
  });

  it('T-ACUERDO-2: con Acuerdo VENCIDO lanza ACUERDO_NO_ACTIVO', () => {
    const acuerdoVENCIDO = { ...ACUERDO_BASE, estado: 'VENCIDO' as const };
    expect(() =>
      calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, acuerdoVENCIDO),
    ).toThrow(/ACUERDO_NO_ACTIVO/);
  });

  it('T-ACUERDO-3: con Acuerdo DEROGADO lanza ACUERDO_NO_ACTIVO', () => {
    const acuerdoDEROGADO = { ...ACUERDO_BASE, estado: 'DEROGADO' as const };
    expect(() =>
      calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, acuerdoDEROGADO),
    ).toThrow(/ACUERDO_NO_ACTIVO/);
  });

  it('T-ACUERDO-4 (backward-compat): Acuerdo=null NO throw (caso legacy)', () => {
    expect(() =>
      calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, null),
    ).not.toThrow();
  });

  it('T-ACUERDO-5 (backward-compat): Acuerdo sin `estado` (legacy) NO throw', () => {
    // Acuerdo legacy del 04-08 NO tiene campo estado. El check debe
    // skip silenciosamente, no romper backward-compat.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acuerdoLegacy = { ...ACUERDO_BASE } as any;
    delete acuerdoLegacy.estado;
    expect(() =>
      calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, acuerdoLegacy),
    ).not.toThrow();
  });

  it('T-ACUERDO-6: Acuerdo ACTIVO aplica factores normalmente (no throw)', () => {
    const acuerdoACTIVO = { ...ACUERDO_BASE, estado: 'ACTIVO' as const };
    expect(() =>
      calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, acuerdoACTIVO),
    ).not.toThrow();
  });
});
