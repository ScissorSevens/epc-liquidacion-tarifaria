/**
 * Tests E2E del motor tarifario refactorizado — Res CRA 825/2017 +
 * Res CRA 750/2016 (subsidios por bloques + consumo básico).
 *
 * Caso de prueba canonico (sección 9 de la guia de validacion):
 *
 *   usuario: RESIDENCIAL, estrato 1
 *   lectura_anterior: 250, lectura_actual: 265
 *   cma = 8.000 (cargo fijo)
 *   cmo = 1.200 (peso/m3)
 *   cmi = 500 (peso/m3)
 *   cmt = 100 (peso/m3)
 *   limite_basico_periodo_m3 = 11 (altitud > 2.000 msnm)
 *   factor_subsidio_e1_cf = -0.60
 *   factor_subsidio_e1_basico = -0.60
 *   factor_subsidio_e1_excedente = 0
 *
 *   consumo = 265 - 250 = 15 m3
 *   cargo_consumo_unitario = 1.200 + 500 + 100 = 1.800
 *   consumo_basico = 11 m3 (limite altitud > 2.000)
 *   consumo_excedente = 4 m3
 *   valor_basico = 11 * 1.800 = 19.800
 *   valor_excedente = 4 * 1.800 = 7.200
 *   subsidio_cf = 8.000 * 0.60 = 4.800
 *   subsidio_basico = 19.800 * 0.60 = 11.880
 *   total = 8.000 + 19.800 + 7.200 - 4.800 - 11.880 = 18.320
 */

import { calcularLiquidacion } from '../motor-tarifario';
import type { AcuerdoMunicipal, ParametrosTarifa } from '../types';

describe('calcularLiquidacion — Subsidios por bloques (Res CRA 825/2017 compliance)', () => {
  it('caso completo E1 15 m3 altitud >2.000 → total 18.320 (caso de la guia seccion 9)', () => {
    const parametros: ParametrosTarifa = {
      id_parametros: 1,
      id_prestador: 0,
      id_acuerdo: 1,
      periodo: 2026,
      cma: 8_000,
      cmo: 1_200,
      cmi: 500,
      cmt: 100,
      cmviaa: 0,
      aplica_cmviaa: false,
      agua_suministrada_m3_anio: 100_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 1,
      aplica_minimo_vital: false,
      m3_gratis_minimo_vital: 0,
      ipuf_indice: 1.0,
      cargo_fijo_resultante: 8_000,
      cargo_consumo_resultante: 1_800,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      minimo_vital: null,
      altitud_msnm: 2_600, // altitud > 2.000 → limite 11 m3/mes
      vigente_desde: '2026-01-01',
      vigente_hasta: '2026-12-31',
      anio_base: 2016,
      factor_indexacion_ipc: 1.0,
      created_at: '2026-01-01T00:00:00',
    };
    const acuerdo: AcuerdoMunicipal = {
      id_acuerdo: 1,
      id_prestador: 0,
      // Legacy (backward-compat)
      factor_subsidio_e1: -0.60,
      factor_subsidio_e2: -0.50,
      factor_subsidio_e3: -0.40,
      // 3 porcentajes (nuevo)
      factor_subsidio_e1_cf: -0.60,
      factor_subsidio_e1_basico: -0.60,
      factor_subsidio_e1_excedente: 0,
      factor_subsidio_e2_cf: -0.50,
      factor_subsidio_e2_basico: -0.50,
      factor_subsidio_e2_excedente: 0,
      factor_subsidio_e3_cf: -0.40,
      factor_subsidio_e3_basico: -0.40,
      factor_subsidio_e3_excedente: 0,
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
    const r = calcularLiquidacion(
      { id_prestador: 0, consumo_m3: 15, estrato: 1, categoria_uso: 'residencial' },
      parametros,
      acuerdo,
    );
    // Validaciones del caso de la guia:
    expect(r.consumo_basico_m3).toBe(11);
    expect(r.consumo_excedente_m3).toBe(4);
    expect(r.valor_basico).toBe(19_800);
    expect(r.valor_excedente).toBe(7_200);
    expect(r.subsidio_cf).toBe(4_800);
    expect(r.subsidio_basico).toBe(11_880);
    expect(r.subsidio_excedente).toBe(0);
    expect(r.subsidio).toBe(16_680); // 4_800 + 11_880
    expect(r.total).toBe(18_320);
  });

  it('consumo bajo el limite basico (10 m3, altitud >2.000) → todo basico, excedente 0', () => {
    const parametros: ParametrosTarifa = {
      id_parametros: 1,
      id_prestador: 0,
      id_acuerdo: 1,
      periodo: 2026,
      cma: 8_000,
      cmo: 1_200,
      cmi: 500,
      cmt: 100,
      cmviaa: 0,
      aplica_cmviaa: false,
      agua_suministrada_m3_anio: 100_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 1,
      aplica_minimo_vital: false,
      m3_gratis_minimo_vital: 0,
      ipuf_indice: 1.0,
      cargo_fijo_resultante: 8_000,
      cargo_consumo_resultante: 1_800,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      minimo_vital: null,
      altitud_msnm: 2_600,
      vigente_desde: '2026-01-01',
      vigente_hasta: '2026-12-31',
      anio_base: 2016,
      factor_indexacion_ipc: 1.0,
      created_at: '2026-01-01T00:00:00',
    };
    const acuerdo: AcuerdoMunicipal = {
      id_acuerdo: 1,
      id_prestador: 0,
      factor_subsidio_e1: -0.60,
      factor_subsidio_e2: -0.50,
      factor_subsidio_e3: -0.40,
      factor_subsidio_e1_cf: -0.60,
      factor_subsidio_e1_basico: -0.60,
      factor_subsidio_e1_excedente: 0,
      factor_subsidio_e2_cf: -0.50,
      factor_subsidio_e2_basico: -0.50,
      factor_subsidio_e2_excedente: 0,
      factor_subsidio_e3_cf: -0.40,
      factor_subsidio_e3_basico: -0.40,
      factor_subsidio_e3_excedente: 0,
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
    const r = calcularLiquidacion(
      { id_prestador: 0, consumo_m3: 10, estrato: 1, categoria_uso: 'residencial' },
      parametros,
      acuerdo,
    );
    expect(r.consumo_basico_m3).toBe(10);
    expect(r.consumo_excedente_m3).toBe(0);
    expect(r.subsidio_cf).toBe(4_800);
    expect(r.subsidio_basico).toBe(Math.round(0.60 * 10 * 1_800)); // 10.800
    expect(r.subsidio_excedente).toBe(0);
    expect(r.subsidio).toBe(15_600);
  });

  it('altitud ≤ 1.000 → limite 16 m3 (caso E1 con 15 m3 → todo basico)', () => {
    const parametros: ParametrosTarifa = {
      id_parametros: 1,
      id_prestador: 0,
      id_acuerdo: 1,
      periodo: 2026,
      cma: 8_000,
      cmo: 1_200,
      cmi: 500,
      cmt: 100,
      cmviaa: 0,
      aplica_cmviaa: false,
      agua_suministrada_m3_anio: 100_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 1,
      aplica_minimo_vital: false,
      m3_gratis_minimo_vital: 0,
      ipuf_indice: 1.0,
      cargo_fijo_resultante: 8_000,
      cargo_consumo_resultante: 1_800,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      minimo_vital: null,
      altitud_msnm: 800, // altitud ≤ 1.000 → limite 16 m3/mes
      vigente_desde: '2026-01-01',
      vigente_hasta: '2026-12-31',
      anio_base: 2016,
      factor_indexacion_ipc: 1.0,
      created_at: '2026-01-01T00:00:00',
    };
    const acuerdo: AcuerdoMunicipal = {
      id_acuerdo: 1,
      id_prestador: 0,
      factor_subsidio_e1: -0.60,
      factor_subsidio_e2: -0.50,
      factor_subsidio_e3: -0.40,
      factor_subsidio_e1_cf: -0.60,
      factor_subsidio_e1_basico: -0.60,
      factor_subsidio_e1_excedente: 0,
      factor_subsidio_e2_cf: -0.50,
      factor_subsidio_e2_basico: -0.50,
      factor_subsidio_e2_excedente: 0,
      factor_subsidio_e3_cf: -0.40,
      factor_subsidio_e3_basico: -0.40,
      factor_subsidio_e3_excedente: 0,
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
    const r = calcularLiquidacion(
      { id_prestador: 0, consumo_m3: 15, estrato: 1, categoria_uso: 'residencial' },
      parametros,
      acuerdo,
    );
    expect(r.consumo_basico_m3).toBe(15);
    expect(r.consumo_excedente_m3).toBe(0);
    expect(r.subsidio_cf).toBe(4_800);
    expect(r.subsidio_basico).toBe(Math.round(0.60 * 15 * 1_800)); // 16.200
    expect(r.subsidio_excedente).toBe(0);
    // CF + valor_basico - subsidio_cf - subsidio_basico
    // = 8.000 + 15*1.800 - 4.800 - 16.200
    // = 8.000 + 27.000 - 4.800 - 16.200
    // = 14.000
    expect(r.total).toBe(14_000);
  });

  it('Acuerdo legacy (sin 3 porcentajes nuevos) → usa factor_subsidio_e1 como fallback sobre CF + basico (legacy compat)', () => {
    // El codigo debe seguir funcionando con datos legacy que solo tienen
    // el campo `factor_subsidio_e1`. Si los nuevos campos no estan, el
    // motor usa el legacy como factor unico sobre el subtotal.
    const parametros: ParametrosTarifa = {
      id_parametros: 1,
      id_prestador: 0,
      id_acuerdo: 1,
      periodo: 2026,
      cma: 8_000,
      cmo: 1_200,
      cmi: 500,
      cmt: 100,
      cmviaa: 0,
      aplica_cmviaa: false,
      agua_suministrada_m3_anio: 100_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 1,
      aplica_minimo_vital: false,
      m3_gratis_minimo_vital: 0,
      ipuf_indice: 1.0,
      cargo_fijo_resultante: 8_000,
      cargo_consumo_resultante: 1_800,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      minimo_vital: null,
      altitud_msnm: 2_600,
      vigente_desde: '2026-01-01',
      vigente_hasta: '2026-12-31',
      anio_base: 2016,
      factor_indexacion_ipc: 1.0,
      created_at: '2026-01-01T00:00:00',
    };
    const acuerdoLegacy: AcuerdoMunicipal = {
      id_acuerdo: 1,
      id_prestador: 0,
      // Solo legacy, sin 3 porcentajes
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
    const r = calcularLiquidacion(
      { id_prestador: 0, consumo_m3: 15, estrato: 1, categoria_uso: 'residencial' },
      parametros,
      acuerdoLegacy,
    );
    // Comportamiento legacy: subsidio = 0.60 * (CF + CC).
    // CC = 1.800 * 15 = 27.000
    // base = 8.000 + 27.000 = 35.000
    // subsidio = 0.60 * 35.000 = 21.000
    // total = 35.000 - 21.000 = 14.000
    expect(r.subsidio).toBe(21_000);
    expect(r.total).toBe(14_000);
  });
});