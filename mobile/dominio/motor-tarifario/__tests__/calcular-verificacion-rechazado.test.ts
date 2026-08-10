/**
 * RED test para el gate `estado_verificacion = 'RECHAZADO'` en
 * `calcularLiquidacion`.
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (task 2.13 RED).
 *
 * Mismo patrón que PENDIENTE (task 2.11) pero con motivo distinto:
 *   `motivo_no_subsidio = 'suscripcion_rechazada'`
 *
 * RECHAZADO es regulación: el admin impugnó oficialmente el estrato del
 * suscriptor (probablemente con soporte de la entidad de planeación o del
 * SUI). El motor NO tira error — solo aplica factor 0 con metadata
 * explicativa. La factura sigue emitiéndose con CF+CC plenos.
 *
 * Decisión B/B/B:
 *   - RECHAZADO NO lanza error (vs PENDIENTE que es "falta verificar",
 *     RECHAZADO es "verificado y NO subsidia"). Razón: el rechazo es
 *     terminal — no hay acción correctiva posible, solo documentar.
 *   - Misma metadata key (`motivo_no_subsidio`) con valor distinto,
 *     vs nuevo campo `motivo_rechazo`. Razón: ambos casos son "no
 *     subsidia" regulatorio; un solo campo simplifica queries de
 *     auditoría.
 *   - E5/E6 RECHAZADO: igual que PENDIENTE, NO afecta contribuciones.
 *     Razón: la contribución es por estrato alto, no por verificación.
 */

import { calcularLiquidacion } from '../motor-tarifario';
import { ACUERDO_BASE, entradaBase, PARAMETROS_BASE } from './fixtures-ambito';
import type { ParametrosTarifa } from '../types';

// Mismo override que en calcular-verificacion-pendiente.test.ts: cargo_fijo_resultante
// y cargo_consumo_resultante > 0 para que el cálculo genere valores monetarios
// no-cero cuando el Acuerdo subsidia y poder distinguir RED de GREEN.
const PARAMETROS: ParametrosTarifa = {
  ...PARAMETROS_BASE,
  cargo_fijo_resultante: 10_000,
  cargo_consumo_resultante: 2_000,
};

describe('calcularLiquidacion — gate estado_verificacion RECHAZADO (task 2.13 RED)', () => {
  it('T-VERIF-RECH-1: E1 residencial RECHAZADO → factor 0, sin subsidio', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 1, estado_verificacion: 'RECHAZADO' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBe(0);
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBe(0);
    expect(r.total).toBe(r.cargo_fijo + r.cc_total);
  });

  it('T-VERIF-RECH-2: E2 residencial RECHAZADO → factor 0, sin subsidio', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 2, estado_verificacion: 'RECHAZADO' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBe(0);
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBe(0);
    expect(r.total).toBe(r.cargo_fijo + r.cc_total);
  });

  it('T-VERIF-RECH-3: E3 residencial RECHAZADO → factor 0, sin subsidio', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 3, estado_verificacion: 'RECHAZADO' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBe(0);
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBe(0);
    expect(r.total).toBe(r.cargo_fijo + r.cc_total);
  });

  it('T-VERIF-RECH-4: metadata.motivo_no_subsidio = suscripcion_rechazada', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 1, estado_verificacion: 'RECHAZADO' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.metadata.motivo_no_subsidio).toBe('suscripcion_rechazada');
  });

  it('T-VERIF-RECH-5: E5 residencial RECHAZADO → contribución NO afectada', () => {
    // Igual que PENDIENTE: la verificación es gate de SUBSIDIO. La
    // contribución E5/E6 sigue aplicando.
    const r = calcularLiquidacion(
      entradaBase({ estrato: 5, estado_verificacion: 'RECHAZADO' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.contribucion).toBeGreaterThan(0);
    expect(r.factor_aplicado).toBeGreaterThan(0);
  });

  it('T-VERIF-RECH-6: comercial E1 RECHAZADO → contribución comercial NO afectada', () => {
    const r = calcularLiquidacion(
      entradaBase({
        estrato: 1,
        categoria_uso: 'comercial',
        estado_verificacion: 'RECHAZADO',
      }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.contribucion).toBeGreaterThan(0);
    expect(r.subsidio).toBe(0);
  });

  it('T-VERIF-RECH-7: oficial E1 RECHAZADO → tarifa plena (factor 0 por categoría)', () => {
    const r = calcularLiquidacion(
      entradaBase({
        estrato: 1,
        categoria_uso: 'oficial',
        estado_verificacion: 'RECHAZADO',
      }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBe(0);
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBe(0);
    expect(r.total).toBe(r.cargo_fijo + r.cc_total);
  });
});
