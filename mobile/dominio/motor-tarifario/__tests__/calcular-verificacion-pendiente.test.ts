/**
 * RED test para el gate `estado_verificacion = 'PENDIENTE'` en
 * `calcularLiquidacion`.
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (task 2.11 RED).
 *
 * Decisión arquitectónica:
 *   - E1-E3 residencial con `estado_verificacion = 'PENDIENTE'` → factor 0
 *     (sin subsidio, sin contribución).
 *   - Output: `subsidio = 0`, `contribucion = 0`, `total = cargoFijo + ccTotal`.
 *   - Metadata registra `motivo_no_subsidio = 'suscripcion_pendiente_verificacion'`.
 *   - Comercial/industrial/oficial NO se ven afectados (no subsidian anyway).
 *   - E5/E6 residencial PENDIENTE mantiene la contribución (regulatorio:
 *     la contribución NO depende de verificación oficial del estrato).
 *   - Callers legacy sin `estado_verificacion` asumen VERIFICADO (default
 *     histórico) — no rompe los 40 callers que no setean el campo.
 *
 * Decisión B/B/B:
 *   - Soft gate (factor 0 + metadata) vs throw → soft. Razón: regulación
 *     indica "no subsidiar", NO "bloquear liquidación". El suscriptor
 *     igual recibe factura con CF + CC plenos.
 *   - Aplicar también a E5/E6 contribuciones? → NO. Razón: la contribución
 *     es un recargo por estrato alto, no un beneficio social, y la
 *     verificación oficial del estrato NO es precondición regulatoria
 *     para cobrarla. Si en el futuro la regulación exige verificar E5/E6,
 *     se agrega como gate separado.
 */

import { calcularLiquidacion } from '../motor-tarifario';
import { ACUERDO_BASE, entradaBase, PARAMETROS_BASE } from './fixtures-ambito';
import type { ParametrosTarifa } from '../types';

/**
 * Override de PARAMETROS_BASE con `cargo_fijo_resultante` y
 * `cargo_consumo_resultante` > 0 para que el cálculo de subsidio genere
 * valores monetarios NO-cero cuando el Acuerdo subsidia. Sin esto, el
 * motor trabaja con CF=0 y CC=0 (defaults del fixture base) y no se
 * puede distinguir RED de GREEN monetariamente.
 *
 * Decisión B/B/B: usar `cargo_fijo_resultante` y `cargo_consumo_resultante`
 * pre-calculados en lugar de tocar `cma`/`cmo`/`cmi`. Razón: el motor usa
 * los resultantes pre-calculados (decisión auditoría histórica, ver
 * motor-tarifario.ts:217-228) — modificar `cma` no cambia el cálculo.
 */
const PARAMETROS: ParametrosTarifa = {
  ...PARAMETROS_BASE,
  cargo_fijo_resultante: 10_000,
  cargo_consumo_resultante: 2_000,
};

describe('calcularLiquidacion — gate estado_verificacion PENDIENTE (task 2.11 RED)', () => {
  it('T-VERIF-PEND-1: E1 residencial PENDIENTE → factor 0, sin subsidio', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 1, estado_verificacion: 'PENDIENTE' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBe(0);
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBe(0);
    expect(r.total).toBe(r.cargo_fijo + r.cc_total);
  });

  it('T-VERIF-PEND-2: E2 residencial PENDIENTE → factor 0, sin subsidio', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 2, estado_verificacion: 'PENDIENTE' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBe(0);
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBe(0);
    expect(r.total).toBe(r.cargo_fijo + r.cc_total);
  });

  it('T-VERIF-PEND-3: E3 residencial PENDIENTE → factor 0, sin subsidio', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 3, estado_verificacion: 'PENDIENTE' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBe(0);
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBe(0);
    expect(r.total).toBe(r.cargo_fijo + r.cc_total);
  });

  it('T-VERIF-PEND-4: metadata.motivo_no_subsidio = suscripcion_pendiente_verificacion', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 1, estado_verificacion: 'PENDIENTE' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.metadata.motivo_no_subsidio).toBe('suscripcion_pendiente_verificacion');
  });

  it('T-VERIF-PEND-5 (backward-compat): estado_verificacion undefined → asume VERIFICADO', () => {
    // 40 callers legacy del motor NO setean el campo. El motor debe
    // asumir VERIFICADO y subsidiar normalmente.
    const r = calcularLiquidacion(
      entradaBase({ estrato: 1 }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBeLessThan(0);
    expect(r.subsidio).toBeGreaterThan(0);
  });

  it('T-VERIF-PEND-6 (backward-compat): VERIFICADO explícito → aplica subsidio normalmente', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 1, estado_verificacion: 'VERIFICADO' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBeLessThan(0);
    expect(r.subsidio).toBeGreaterThan(0);
  });

  it('T-VERIF-PEND-7: E5 residencial PENDIENTE → contribución NO se ve afectada', () => {
    // La verificación es solo gate de SUBSIDIO. La contribución E5/E6
    // sigue aplicando (regulatoriamente la contribución NO depende de
    // verificación oficial del estrato).
    const r = calcularLiquidacion(
      entradaBase({ estrato: 5, estado_verificacion: 'PENDIENTE' }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.contribucion).toBeGreaterThan(0);
    expect(r.factor_aplicado).toBeGreaterThan(0);
  });

  it('T-VERIF-PEND-8: comercial E1 PENDIENTE → contribución comercial NO afectada', () => {
    const r = calcularLiquidacion(
      entradaBase({
        estrato: 1,
        categoria_uso: 'comercial',
        estado_verificacion: 'PENDIENTE',
      }),
      PARAMETROS,
      ACUERDO_BASE,
    );
    expect(r.contribucion).toBeGreaterThan(0);
    expect(r.subsidio).toBe(0);
  });

  it('T-VERIF-PEND-9: oficial E1 PENDIENTE → tarifa plena (factor 0 por categoría, no por gate)', () => {
    const r = calcularLiquidacion(
      entradaBase({
        estrato: 1,
        categoria_uso: 'oficial',
        estado_verificacion: 'PENDIENTE',
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
