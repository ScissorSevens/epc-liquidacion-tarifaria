/**
 * Tests del motor tarifario conforme a Res CRA 825/2017 + Res 907/2019.
 * Multi-tenant: cada escenario usa ParametrosTarifa + AcuerdoMunicipal
 * del prestador.
 *
 * Cobertura (alineada con spec #646 + design #648):
 *  - Cargo Fijo (art. 9): basico, con CMAA, sin CMAA
 *  - Cargo por Consumo (art. 10 mod 907/2019 art. 14): sin CMVIAA,
 *    con CMVIAA, sin CMVIAA cuando flag inactivo
 *  - Topes L142/1994 art. 99.6: E1-E6 dentro de rango, fuera de rango
 *  - Categorías de uso: comercial, industrial, oficial, especial
 *  - Mínimo vital: 6 escenarios (flag, m3_gratis, comercial, etc.)
 *  - Multi-tenant: 2 prestadores no contamine
 *  - Determinismo: 100 invocaciones idénticas
 *  - Acuerdo null → topes nacionales
 *  - Validaciones: Parametros null, id_prestador mismatch, estrato
 */

import {
  calcularCCUnitario,
  calcularFactor,
  calcularLiquidacion,
  aplicarMinimoVital,
  caparFactorEstrato,
  TOPES_NACIONALES,
} from '../motor-tarifario';
import type { AcuerdoMunicipal, ParametrosTarifa, EntradaCalculo } from '../types';

// ===== Fixtures =====

const PARAMETROS_BASE: ParametrosTarifa = {
  id_parametros: 1,
  id_prestador: 0,
  id_acuerdo: 1,
  periodo: 2026,
  cma: 30_000_000,
  cmo: 1500,
  cmi: 300,
  cmt: 200,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 100_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 3000,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2026-12-31',
  created_at: '2026-01-01T00:00:00',
};

const ACUERDO_BASE: AcuerdoMunicipal = {
  id_acuerdo: 1,
  id_prestador: 0,
  factor_subsidio_e1: -0.60,
  factor_subsidio_e2: -0.50,
  factor_subsidio_e3: -0.40,
  factor_contribucion_e5: 0.50,
  factor_contribucion_e6: 0.60,
  factor_contribucion_comercial: 0.50,
  factor_contribucion_industrial: 0.30,
  fecha_vigencia_desde: '2026-01-01',
  fecha_vigencia_hasta: '2026-12-31',
  acto_administrativo_url: null,
  observaciones: null,
  created_at: '2026-01-01T00:00:00',
};

function entradaBase(overrides: Partial<EntradaCalculo> = {}): EntradaCalculo {
  return {
    id_prestador: 0,
    consumo_m3: 18,
    estrato: 3,
    categoria_uso: 'residencial',
    ...overrides,
  };
}

// ===== CF (art. 9) =====

describe('calcularLiquidacion — Cargo Fijo (art. 9 Res 825/2017)', () => {
  it('CF básico residencial E3 con CMA=30M N=3000', () => {
    const r = calcularLiquidacion(entradaBase(), PARAMETROS_BASE, ACUERDO_BASE);
    // CF = CMA/N = 30_000_000 / 3000 = 10_000
    expect(r.cargo_fijo).toBe(10_000);
  });

  it('CF con CMAA cuando aplica_cmviaa=true (extension analogica)', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      cmviaa: 3_000_000,
      aplica_cmviaa: true,
    };
    const r = calcularLiquidacion(entradaBase(), params, ACUERDO_BASE);
    // (30M + 3M) / 3000 = 11_000 (CMVIAA no se suma al CF, al CC unitario)
    // El CF sigue siendo CMA/N = 30M/3000 = 10_000
    expect(r.cargo_fijo).toBe(10_000);
    // CC unitario SI incluye CMVIAA
    expect(r.cc_unitario).toBeGreaterThan(0);
  });

  it('CF idéntico para todas las categorías de uso (es solo CMA/N)', () => {
    const cats = ['residencial', 'comercial', 'industrial', 'oficial', 'especial'] as const;
    const cfs = cats.map((cat) =>
      calcularLiquidacion(entradaBase({ categoria_uso: cat }), PARAMETROS_BASE, ACUERDO_BASE).cargo_fijo,
    );
    expect(new Set(cfs).size).toBe(1);
    expect(cfs[0]).toBe(10_000);
  });
});

// ===== CC (art. 10 mod 907/2019 art. 14) =====

describe('calcularLiquidacion — Cargo por Consumo (art. 10 mod 907/2019)', () => {
  it('CC básico E3 residencial sin CMVIAA', () => {
    const r = calcularLiquidacion(entradaBase(), PARAMETROS_BASE, ACUERDO_BASE);
    // ASP = 100_000 - 6*12*3000 = 100_000 - 216_000 = NEGATIVO
    // Math.max(_, 1) = 1
    // CC unit = (1500+300+200)/1 + 0 = 2000
    // CC total = 2000 * 18 = 36_000
    expect(r.cc_unitario).toBeCloseTo(2000, 2);
    expect(r.cc_total).toBe(36_000);
  });

  it('CC con CMVIAA cuando flag activo', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000, // ASP positivo
      cmviaa: 50,
      aplica_cmviaa: true,
    };
    // ASP = 500_000 - 216_000 = 284_000
    // CC unit = (1500+300+200)/284_000 + 50 = 0.00704... + 50 ≈ 50.007
    // CC total = 50.007 * 18 ≈ 900.13 → 900
    const r = calcularLiquidacion(entradaBase(), params, ACUERDO_BASE);
    expect(r.cc_unitario).toBeGreaterThan(50);
    expect(r.cc_unitario).toBeLessThan(51);
    expect(r.metadata.cmviaa_aplicado).toBe(true);
  });

  it('CC sin CMVIAA cuando flag inactivo (aunque cmviaa > 0)', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000,
      cmviaa: 50,
      aplica_cmviaa: false,
    };
    const r = calcularLiquidacion(entradaBase(), params, ACUERDO_BASE);
    expect(r.metadata.cmviaa_aplicado).toBe(false);
  });
});

// ===== Topes L142/1994 =====

describe('calcularLiquidacion — Topes L142/1994 art. 99.6', () => {
  it.each([1, 2, 3, 4, 5, 6])('E%d respeta topes nacionales', (estrato) => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: estrato as 1 | 2 | 3 | 4 | 5 | 6 }),
      PARAMETROS_BASE,
      ACUERDO_BASE,
    );
    const f = r.factor_aplicado;
    if (estrato === 1) expect(f).toBeGreaterThanOrEqual(-0.60);
    if (estrato === 2) expect(f).toBeGreaterThanOrEqual(-0.50);
    if (estrato === 3) expect(f).toBeGreaterThanOrEqual(-0.40);
    if (estrato === 4) expect(f).toBe(0);
    if (estrato === 5) expect(f).toBeLessThanOrEqual(+0.50);
    if (estrato === 6) expect(f).toBeLessThanOrEqual(+0.60);
  });

  it('E1 con Acuerdo -0.80 (fuera de rango) se CAPEA a -0.60 + metadata', () => {
    const acuerdo: AcuerdoMunicipal = { ...ACUERDO_BASE, factor_subsidio_e1: -0.80 };
    const r = calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, acuerdo);
    expect(r.factor_aplicado).toBeCloseTo(-0.60, 5);
    expect(r.metadata.factor_capeado).toBe(true);
  });

  it('E1 con Acuerdo -0.40 (dentro de rango) se respeta tal cual', () => {
    const acuerdo: AcuerdoMunicipal = { ...ACUERDO_BASE, factor_subsidio_e1: -0.40 };
    const r = calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, acuerdo);
    expect(r.factor_aplicado).toBeCloseTo(-0.40, 5);
    expect(r.metadata.factor_capeado).toBe(false);
  });

  it('estrato fuera de rango (7) lanza error', () => {
    expect(() =>
      calcularLiquidacion(entradaBase({ estrato: 7 as 1 }), PARAMETROS_BASE, ACUERDO_BASE),
    ).toThrow('Estrato fuera de rango 1-6');
  });
});

// ===== Categorías de uso =====

describe('calcularLiquidacion — Categorías de uso (Q10)', () => {
  it('comercial E1 → contribución comercial, NUNCA subsidio', () => {
    const acuerdo: AcuerdoMunicipal = { ...ACUERDO_BASE, factor_subsidio_e1: -0.60 };
    const r = calcularLiquidacion(
      entradaBase({ estrato: 1, categoria_uso: 'comercial' }),
      PARAMETROS_BASE,
      acuerdo,
    );
    expect(r.factor_aplicado).toBeCloseTo(0.50, 5); // factor_contribucion_comercial default
    expect(r.subsidio).toBe(0);
    expect(r.contribucion).toBeGreaterThan(0);
  });

  it('industrial E5 → contribución industrial (NO E5)', () => {
    const r = calcularLiquidacion(
      entradaBase({ estrato: 5, categoria_uso: 'industrial' }),
      PARAMETROS_BASE,
      ACUERDO_BASE,
    );
    expect(r.factor_aplicado).toBeCloseTo(0.30, 5); // factor_contribucion_industrial default
    expect(r.contribucion).toBeGreaterThan(0);
    expect(r.subsidio).toBe(0);
  });

  it('oficial cualquier estrato → tarifa plena, factor 0', () => {
    for (const e of [1, 2, 3, 4, 5, 6] as const) {
      const r = calcularLiquidacion(
        entradaBase({ estrato: e, categoria_uso: 'oficial' }),
        PARAMETROS_BASE,
        ACUERDO_BASE,
      );
      expect(r.factor_aplicado).toBe(0);
      expect(r.subsidio).toBe(0);
      expect(r.contribucion).toBe(0);
    }
  });

  it('especial se comporta como residencial', () => {
    const r1 = calcularLiquidacion(
      entradaBase({ categoria_uso: 'residencial', estrato: 2 }),
      PARAMETROS_BASE,
      ACUERDO_BASE,
    );
    const r2 = calcularLiquidacion(
      entradaBase({ categoria_uso: 'especial', estrato: 2 }),
      PARAMETROS_BASE,
      ACUERDO_BASE,
    );
    expect(r1.factor_aplicado).toBe(r2.factor_aplicado);
    expect(r1.subsidio).toBe(r2.subsidio);
  });
});

// ===== Mínimo vital =====

describe('calcularLiquidacion — Mínimo vital (Q9)', () => {
  it('flag=false → comportamiento sin mínimo vital', () => {
    const params: ParametrosTarifa = { ...PARAMETROS_BASE, agua_suministrada_m3_anio: 500_000 };
    const r = calcularLiquidacion(entradaBase({ consumo_m3: 25 }), params, ACUERDO_BASE);
    expect(r.consumo_efectivo_m3).toBe(25);
    expect(r.metadata.minimo_vital_aplicado).toBe(false);
  });

  it('flag=true + m3_gratis=0 → inactivo', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 0,
    };
    const r = calcularLiquidacion(entradaBase({ consumo_m3: 25 }), params, ACUERDO_BASE);
    expect(r.consumo_efectivo_m3).toBe(25);
    expect(r.metadata.minimo_vital_aplicado).toBe(false);
  });

  it('flag=true + consumo=10 + m3_gratis=6 → CC sobre 4 m³', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 6,
    };
    const r = calcularLiquidacion(entradaBase({ consumo_m3: 10 }), params, ACUERDO_BASE);
    expect(r.consumo_efectivo_m3).toBe(4);
    expect(r.metadata.minimo_vital_aplicado).toBe(true);
  });

  it('flag=true + consumo=3 ≤ m3_gratis=6 → CC = 0', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 6,
    };
    const r = calcularLiquidacion(entradaBase({ consumo_m3: 3 }), params, ACUERDO_BASE);
    expect(r.consumo_efectivo_m3).toBe(0);
    expect(r.cc_total).toBe(0);
  });

  it('flag=true + categoría=comercial → NO aplica', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 6,
    };
    const r = calcularLiquidacion(
      entradaBase({ consumo_m3: 10, categoria_uso: 'comercial' }),
      params,
      ACUERDO_BASE,
    );
    expect(r.consumo_efectivo_m3).toBe(10);
    expect(r.metadata.minimo_vital_aplicado).toBe(false);
  });

  it('mínimo vital aplica ANTES del subsidio', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 6,
    };
    const r = calcularLiquidacion(
      entradaBase({ consumo_m3: 20, estrato: 1, categoria_uso: 'residencial' }),
      params,
      ACUERDO_BASE,
    );
    expect(r.consumo_efectivo_m3).toBe(14);
    expect(r.metadata.minimo_vital_aplicado).toBe(true);
    // Subsidio se aplica sobre CF + CC(14m³), no sobre 20m³
    expect(r.subsidio).toBeGreaterThan(0);
  });
});

// ===== Multi-tenant =====

describe('calcularLiquidacion — Multi-tenant', () => {
  it('Mismo input + Acuerdo A vs B → outputs diferentes', () => {
    const acuerdoA: AcuerdoMunicipal = { ...ACUERDO_BASE, id_acuerdo: 1, factor_subsidio_e1: -0.60 };
    const acuerdoB: AcuerdoMunicipal = { ...ACUERDO_BASE, id_acuerdo: 2, factor_subsidio_e1: -0.30 };
    const entrada = entradaBase({ estrato: 1 });
    const rA = calcularLiquidacion(entrada, PARAMETROS_BASE, acuerdoA);
    const rB = calcularLiquidacion(entrada, PARAMETROS_BASE, acuerdoB);
    expect(rA.subsidio).not.toBe(rB.subsidio);
  });

  it('2 prestadores simultáneos en misma corrida NO contaminan configs', () => {
    const paramsX: ParametrosTarifa = { ...PARAMETROS_BASE, id_prestador: 10, cma: 10_000_000 };
    const paramsY: ParametrosTarifa = { ...PARAMETROS_BASE, id_prestador: 20, cma: 50_000_000 };
    const acuerdoX: AcuerdoMunicipal = { ...ACUERDO_BASE, id_prestador: 10, factor_subsidio_e1: -0.10 };
    const acuerdoY: AcuerdoMunicipal = { ...ACUERDO_BASE, id_prestador: 20, factor_subsidio_e1: -0.60 };
    const entX: EntradaCalculo = { id_prestador: 10, consumo_m3: 18, estrato: 1, categoria_uso: 'residencial' };
    const entY: EntradaCalculo = { id_prestador: 20, consumo_m3: 18, estrato: 1, categoria_uso: 'residencial' };
    const rX = calcularLiquidacion(entX, paramsX, acuerdoX);
    const rY = calcularLiquidacion(entY, paramsY, acuerdoY);
    expect(rX.cargo_fijo).toBe(Math.round(10_000_000 / 3000));
    expect(rY.cargo_fijo).toBe(Math.round(50_000_000 / 3000));
    expect(rX.factor_aplicado).toBeCloseTo(-0.10, 5);
    expect(rY.factor_aplicado).toBeCloseTo(-0.60, 5);
  });

  it('Parametros.id_prestador ≠ entrada.id_prestador → error', () => {
    const params: ParametrosTarifa = { ...PARAMETROS_BASE, id_prestador: 5 };
    expect(() => calcularLiquidacion(entradaBase({ id_prestador: 7 }), params, ACUERDO_BASE)).toThrow();
  });

  it('Acuerdo null → usa topes nacionales L142/1994', () => {
    const r = calcularLiquidacion(entradaBase({ estrato: 1 }), PARAMETROS_BASE, null);
    expect(r.factor_aplicado).toBeCloseTo(-0.60, 5); // tope nacional
  });
});

// ===== Determinismo =====

describe('calcularLiquidacion — Determinismo', () => {
  it('100 invocaciones idénticas → outputs bit-exact (excepto timestamp)', () => {
    const results = Array.from({ length: 100 }, () =>
      calcularLiquidacion(entradaBase(), PARAMETROS_BASE, ACUERDO_BASE),
    );
    // Excluir timestamp del compare (varía con Date.now()).
    // Determinismo aplica a TODOS los campos de cálculo.
    const sinTimestamp = (r: typeof results[0]) => {
      const { metadata, ...rest } = r;
      return JSON.stringify({ ...rest, metadata: { ...metadata, calculo_timestamp: 'X' } });
    };
    const first = sinTimestamp(results[0]);
    expect(results.every((r) => sinTimestamp(r) === first)).toBe(true);
  });
});

// ===== Validaciones =====

describe('calcularLiquidacion — Validaciones', () => {
  it('Parametros null → error', () => {
    expect(() =>
      calcularLiquidacion(entradaBase(), null as unknown as ParametrosTarifa, ACUERDO_BASE),
    ).toThrow('ParametrosTarifa requerido');
  });

  it('consumo_m3 negativo → error', () => {
    expect(() =>
      calcularLiquidacion(entradaBase({ consumo_m3: -1 }), PARAMETROS_BASE, ACUERDO_BASE),
    ).toThrow('consumo_m3 no puede ser negativo');
  });
});

// ===== Helpers exportados =====

describe('calcularCCUnitario', () => {
  it('CC unit con ASP = 1 (AS < IPUF*12*N) → costoVariable / 1', () => {
    const u = calcularCCUnitario(PARAMETROS_BASE);
    // ASP = max(100_000 - 216_000, 1) = 1
    // (1500+300+200)/1 = 2000
    expect(u).toBeCloseTo(2000, 2);
  });

  it('CC unit con ASP real y CMVIAA activo', () => {
    const params: ParametrosTarifa = {
      ...PARAMETROS_BASE,
      agua_suministrada_m3_anio: 500_000,
      cmviaa: 50,
      aplica_cmviaa: true,
    };
    const u = calcularCCUnitario(params);
    // ASP = 500_000 - 216_000 = 284_000
    // 2000/284_000 + 50 ≈ 50.007
    expect(u).toBeGreaterThan(50);
  });
});

describe('aplicarMinimoVital', () => {
  it('sin flag → retorna consumo sin cambio', () => {
    expect(aplicarMinimoVital(25, PARAMETROS_BASE, 'residencial')).toBe(25);
  });
  it('flag=true + consumo > m3_gratis → resta', () => {
    const p: ParametrosTarifa = { ...PARAMETROS_BASE, aplica_minimo_vital: true, m3_gratis_minimo_vital: 6 };
    expect(aplicarMinimoVital(10, p, 'residencial')).toBe(4);
  });
  it('flag=true + comercial → no aplica', () => {
    const p: ParametrosTarifa = { ...PARAMETROS_BASE, aplica_minimo_vital: true, m3_gratis_minimo_vital: 6 };
    expect(aplicarMinimoVital(10, p, 'comercial')).toBe(10);
  });
});

describe('calcularFactor', () => {
  it('residencial E1 con Acuerdo -0.60 → -0.60, no capeado', () => {
    const r = calcularFactor(1, 'residencial', ACUERDO_BASE);
    expect(r.factor).toBeCloseTo(-0.60, 5);
    expect(r.capeado).toBe(false);
  });
  it('residencial E1 con Acuerdo -0.80 → capeado a -0.60', () => {
    const a: AcuerdoMunicipal = { ...ACUERDO_BASE, factor_subsidio_e1: -0.80 };
    const r = calcularFactor(1, 'residencial', a);
    expect(r.factor).toBeCloseTo(-0.60, 5);
    expect(r.capeado).toBe(true);
  });
  it('oficial E1 → factor 0, no capeado', () => {
    const r = calcularFactor(1, 'oficial', ACUERDO_BASE);
    expect(r.factor).toBe(0);
    expect(r.capeado).toBe(false);
  });
  it('comercial E1 → factor_comercial Acuerdo', () => {
    const r = calcularFactor(1, 'comercial', ACUERDO_BASE);
    expect(r.factor).toBeCloseTo(0.50, 5);
  });
});

describe('caparFactorEstrato', () => {
  it('capo E1 al tope -0.60', () => {
    expect(caparFactorEstrato(-0.80, 1, 'residencial')).toBeCloseTo(-0.60, 5);
  });
  it('respeto E1 dentro del tope -0.40', () => {
    expect(caparFactorEstrato(-0.40, 1, 'residencial')).toBeCloseTo(-0.40, 5);
  });
  it('E4 = 0', () => {
    expect(caparFactorEstrato(0.5, 4, 'residencial')).toBe(0);
  });
  it('E5 capo al tope +0.50', () => {
    expect(caparFactorEstrato(0.7, 5, 'residencial')).toBeCloseTo(0.50, 5);
  });
  it('E6 capo al tope +0.60', () => {
    expect(caparFactorEstrato(0.8, 6, 'residencial')).toBeCloseTo(0.60, 5);
  });
  it('comercial E1 no se capa (capo es solo residencial/especial)', () => {
    expect(caparFactorEstrato(-0.80, 1, 'comercial')).toBe(-0.80);
  });
});

describe('TOPES_NACIONALES', () => {
  it('subsidios E1=-0.60, E2=-0.50, E3=-0.40', () => {
    expect(TOPES_NACIONALES.SUBSIDIO[1]).toBe(-0.60);
    expect(TOPES_NACIONALES.SUBSIDIO[2]).toBe(-0.50);
    expect(TOPES_NACIONALES.SUBSIDIO[3]).toBe(-0.40);
  });
  it('contribuciones E5=+0.50, E6=+0.60', () => {
    expect(TOPES_NACIONALES.CONTRIBUCION[5]).toBe(0.50);
    expect(TOPES_NACIONALES.CONTRIBUCION[6]).toBe(0.60);
  });
});
