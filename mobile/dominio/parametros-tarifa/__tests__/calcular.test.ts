/**
 * Tests del calculador de cargos resultantes de ParametrosTarifa.
 *
 * Reglas Res CRA 825/2017 + 907/2019:
 *   - CF (cargo fijo por suscriptor/mes) = CMA / N
 *     N = suscriptores_promedio (si CMA esta en componentes_aplicables).
 *   - CC_unitario (cargo por consumo por m³) = CMO + CMI + CMT + CMVIAA
 *     (CMVIAA solo si aplica_cmviaa=true y CMVIAA en componentes_aplicables).
 *   - Los cargos resultantes se PERSISTEN al guardar y NO se recalculan
 *     en cada factura (decision del user: "decoupled from componentes
 *     so future methodology changes don't break historic facturas").
 *
 * `componentes_aplicables` indica qué componentes están ACTIVOS para
 * este prestador. Si un componente NO está en el array, su valor NO
 * contribuye al cargo resultante (caso real: segmento 2 rural a veces
 * NO aplica CMVIAA).
 */

import { calcularCargos, COMPONENTES_TARIFARIOS, type ComponenteTarifa } from '../calcular';
import type { ParametrosTarifa } from '../types';

function baseParametros(overrides: Partial<ParametrosTarifa> = {}): ParametrosTarifa {
  return {
    id_parametros: 1,
    id_prestador: 42,
    id_acuerdo: 1,
    periodo: 2026,
    cma: 12_000_000,
    cmo: 500,
    cmi: 200,
    cmt: 100,
    cmviaa: 50,
    aplica_cmviaa: true,
    agua_suministrada_m3_anio: 50_000,
    ipuf_m3_suscriptor_mes: 6,
    suscriptores_promedio: 1000,
    aplica_minimo_vital: false,
    m3_gratis_minimo_vital: 0,
    ipuf_indice: 1.0,
    cargo_fijo_resultante: 0,
    cargo_consumo_resultante: 0,
    componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
    minimo_vital: null,
    vigente_desde: '2025-01-01',
    vigente_hasta: '2029-12-31',
    created_at: '2026-01-01T00:00:00.000Z',
    anio_base: 2016,
    factor_indexacion_ipc: 1.0,
    ...overrides,
  };
}

describe('calcularCargos — Res CRA 825/2017 art. 9-10 + 907/2019 art. 14', () => {
  /**
   * Decisión param-tarifa-res-825-compliance-phase2: el campo `cma` de
   * ParametrosTarifa representa el CMA normativo en $/suscriptor/mes
   * (NO el CA anual). Por lo tanto, el CF es directamente `cma` sin
   * dividir por suscriptores_promedio. `suscriptores_promedio` se
   * mantiene en el modelo para uso en otras validaciones (CMOG
   * mínimo, MSNM, etc.) pero NO participa en el cálculo del CF.
   *
   * Alineado con art. 9 Res CRA 825/2017 (mod. Res 907/2019 art. 13):
   *   CF acueducto = CMA (sin dividir cuando CMA es mensual).
   *   CF alcantarillado = CMA (idéntico).
   */
  it('cargo_fijo_resultante = cma (sin dividir) cuando CMA está activo', () => {
    const p = baseParametros({ cma: 12_000_000, suscriptores_promedio: 1000 });
    const { cargo_fijo } = calcularCargos(p);
    expect(cargo_fijo).toBe(12_000_000);
  });

  /**
   * cargo_consumo_resultante = cmo + cmi + cmt + cmviaa
   * (cuando aplica_cmviaa=true y CMVIAA está en componentes_aplicables).
   */
  it('cargo_consumo_resultante = cmo + cmi + cmt + cmviaa (cuando aplica_cmviaa=true)', () => {
    const p = baseParametros({ cmo: 500, cmi: 200, cmt: 100, cmviaa: 50, aplica_cmviaa: true });
    const { cargo_consumo } = calcularCargos(p);
    expect(cargo_consumo).toBe(850);
  });

  /**
   * Si el prestador NO aplica CMVIAA (aplica_cmviaa=false), el cargo
   * por consumo NO incluye cmviaa. Default normativo: muchos prestadores
   * rurales segmento 2 NO adhieren a inversion ambiental (Res 0874/2018).
   */
  it('cargo_consumo excluye cmviaa cuando aplica_cmviaa=false', () => {
    const p = baseParametros({ cmo: 500, cmi: 200, cmt: 100, cmviaa: 50, aplica_cmviaa: false });
    const { cargo_consumo } = calcularCargos(p);
    expect(cargo_consumo).toBe(800);
  });

  /**
   * Si un componente NO está en componentes_aplicables, su valor NO
   * contribuye al cargo. Caso de uso: el segmento 2 rural puede NO
   * cargar CMT (tasa ambiental cero o exenta).
   */
  /**
   * Param-tarifa-res-825-compliance-phase2 / task 2.3-2.4: si el
   * prestador opta por inversiones ambientales (cmaa > 0 y
   * aplica_cmviaa=true), el CF incluye CMAA: `cargo_fijo = cma + cmaa`
   * (Res CRA 825/2017 art. 9 mod. 907/2019 art. 13).
   *
   * Solo aplica a ACUEDUCTO — no hay "alcantarillado con inversiones
   * ambientales" equivalente en la normativa actual.
   */
  it('cargo_fijo incluye CMAA cuando aplica_cmviaa=true y cmaa>0', () => {
    const p = baseParametros({
      cma: 8_000,
      cmaa: 2_000,
      aplica_cmviaa: true,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
    });
    const { cargo_fijo } = calcularCargos(p);
    expect(cargo_fijo).toBe(10_000); // 8_000 + 2_000
  });

  it('cargo_fijo NO incluye CMAA cuando aplica_cmviaa=false (aunque cmaa>0)', () => {
    const p = baseParametros({
      cma: 8_000,
      cmaa: 2_000,
      aplica_cmviaa: false,
    });
    const { cargo_fijo } = calcularCargos(p);
    // CMAA desactivado por el prestador → cargo_fijo = solo cma.
    expect(cargo_fijo).toBe(8_000);
  });

  it('cargo_fijo NO incluye CMAA cuando cmaa=null (legacy)', () => {
    const p = baseParametros({
      cma: 8_000,
      aplica_cmviaa: true,
      // cmaa omitido (undefined) — legacy data sin inversiones ambientales.
    });
    const { cargo_fijo } = calcularCargos(p);
    expect(cargo_fijo).toBe(8_000);
  });

  it('cargo_consumo excluye CMT cuando CMT no está en componentes_aplicables', () => {
    const p = baseParametros({
      cmo: 500,
      cmi: 200,
      cmt: 100,
      cmviaa: 50,
      aplica_cmviaa: true,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMVIAA'],
    });
    const { cargo_consumo } = calcularCargos(p);
    expect(cargo_consumo).toBe(750);
  });

  /**
   * Idem para CMA: si no está en componentes_aplicables, cargo_fijo = 0.
   */
  it('cargo_fijo = 0 cuando CMA no está en componentes_aplicables', () => {
    const p = baseParametros({
      cma: 12_000_000,
      suscriptores_promedio: 1000,
      componentes_aplicables: ['CMO', 'CMI', 'CMT', 'CMVIAA'],
    });
    const { cargo_fijo } = calcularCargos(p);
    expect(cargo_fijo).toBe(0);
  });

  /**
   * Edge case: suscriptores_promedio = 0 → division por cero. La funcion
   * debe proteger esto y devolver cargo_fijo = 0 (no NaN, no Infinity).
   * Esto matchea con la validacion del dominio: suscriptores_promedio > 0
   * es requerido, pero la factory debe ser defensiva.
   */
  it('cargo_fijo = 0 cuando suscriptores_promedio = 0 (anti division por cero)', () => {
    const p = baseParametros({ cma: 12_000_000, suscriptores_promedio: 0 });
    const { cargo_fijo } = calcularCargos(p);
    expect(cargo_fijo).toBe(0);
  });

  /**
   * Edge case: suscriptores_promedio negativo (no debería ocurrir por
   * las validaciones del dominio, pero la factory DEBE ser defensiva).
   */
  it('cargo_fijo = 0 cuando suscriptores_promedio < 0', () => {
    const p = baseParametros({ cma: 12_000_000, suscriptores_promedio: -10 });
    const { cargo_fijo } = calcularCargos(p);
    expect(cargo_fijo).toBe(0);
  });

  /**
   * Si TODOS los componentes de consumo están desactivados, cargo_consumo = 0.
   */
  it('cargo_consumo = 0 cuando componentes_aplicables no incluye CMO/CMI/CMT/CMVIAA', () => {
    const p = baseParametros({ componentes_aplicables: ['CMA'] });
    const { cargo_consumo } = calcularCargos(p);
    expect(cargo_consumo).toBe(0);
  });

  /**
   * Triangulacion: caso del segmento 1 urbano (todos los componentes
   * activos). Carga fija 8000 + consumo 950 = exactamente lo que el
   * motor tarifario debería usar.
   */
  it('caso segmento 1 urbano (todos los componentes activos)', () => {
    const p = baseParametros({
      cma: 9_600_000,
      suscriptores_promedio: 1200,
      cmo: 600,
      cmi: 250,
      cmt: 100,
      cmviaa: 0,
      aplica_cmviaa: false,
    });
    const { cargo_fijo, cargo_consumo } = calcularCargos(p);
    // cma es $/suscriptor/mes → cargo_fijo = cma sin dividir.
    expect(cargo_fijo).toBe(9_600_000);
    expect(cargo_consumo).toBe(950);
  });

  /**
   * Triangulacion: caso del segmento 2 rural minimal (solo CMA + CMO).
   * Verifica que la función maneja correctamente subsets arbitrarios.
   */
  it('caso segmento 2 rural minimal (solo CMA + CMO)', () => {
    const p = baseParametros({
      cma: 5_000_000,
      suscriptores_promedio: 500,
      cmo: 800,
      cmi: 200,
      cmt: 100,
      cmviaa: 0,
      aplica_cmviaa: false,
      componentes_aplicables: ['CMA', 'CMO'],
    });
    const { cargo_fijo, cargo_consumo } = calcularCargos(p);
    // cma es $/suscriptor/mes → cargo_fijo = cma sin dividir.
    expect(cargo_fijo).toBe(5_000_000);
    expect(cargo_consumo).toBe(800);
  });

  /**
   * El array COMPONENTES_TARIFARIOS debe tener los 5 componentes
   * canonicos del modelo normativo.
   */
  it('COMPONENTES_TARIFARIOS contiene CMA, CMO, CMI, CMT, CMVIAA', () => {
    expect(COMPONENTES_TARIFARIOS).toEqual(
      expect.arrayContaining(['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA']),
    );
    expect(COMPONENTES_TARIFARIOS).toHaveLength(5);
  });

  /**
   * Sanity: un componente desconocido en componentes_aplicables debe
   * ser IGNORADO (no debe tirar error ni contribuir al calculo).
   * Esto permite forward-compat: si en el futuro se agrega CMX, no
   * rompe el calculo.
   */
  it('componentes desconocidos en componentes_aplicables se ignoran', () => {
    const p = baseParametros({
      cma: 12_000_000,
      suscriptores_promedio: 1000,
      cmo: 500,
      cmi: 200,
      cmt: 100,
      cmviaa: 50,
      aplica_cmviaa: true,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA', 'CMX_FUTURO'],
    });
    const { cargo_fijo, cargo_consumo } = calcularCargos(p);
    // cma es $/suscriptor/mes → cargo_fijo = cma sin dividir.
    expect(cargo_fijo).toBe(12_000_000);
    expect(cargo_consumo).toBe(850);
  });
});

describe('calcularCargos — pure function (no side effects)', () => {
  /**
   * La función NO debe mutar el objeto ParametrosTarifa que recibe.
   * Si lo mutara, contaminaría el store y la UI mostraría un valor
   * "pre-calculado" cuando en realidad todavía no se persistió.
   */
  it('no muta el objeto ParametrosTarifa de entrada', () => {
    const p = baseParametros();
    const snapshot = JSON.stringify(p);
    calcularCargos(p);
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  /**
   * Mismo input debe producir mismo output (determinismo puro).
   */
  it('mismo input → mismo output (determinismo)', () => {
    const p = baseParametros();
    const a = calcularCargos(p);
    const b = calcularCargos(p);
    expect(a).toEqual(b);
  });
});

describe('COMPONENTES_TARIFARIOS — type safety', () => {
  /**
   * ComponenteTarifa es union literal: 'CMA' | 'CMO' | 'CMI' | 'CMT' | 'CMVIAA'.
   * Esto permite que TS autocomplete en los call sites.
   */
  it('ComponenteTarifa cubre todos los miembros de COMPONENTES_TARIFARIOS', () => {
    const c: ComponenteTarifa = 'CMA';
    expect(COMPONENTES_TARIFARIOS).toContain(c);
  });
});
