/**
 * Tests para ParametrosTarifa con campo altitud_msnm (Res CRA 750/2016).
 *
 * El limite de consumo basico (11/13/16 m3/mes) depende de la altitud
 * del prestador sobre el nivel del mar. Este campo se agrega como
 * OPTIONAL para backward-compat con parametros legacy.
 *
 *   altitud > 2.000 msnm  → 11 m3/mes (basico)
 *   altitud 1.000-2.000 msnm → 13 m3/mes
 *   altitud ≤ 1.000 msnm  → 16 m3/mes
 */

import type { ParametrosTarifa } from '../types';

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
  ipuf_indice: 1.0,
  cargo_fijo_resultante: 30_000_000 / 3000,
  cargo_consumo_resultante: 1500 + 300 + 200,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2026-12-31',
  anio_base: 2016,
  factor_indexacion_ipc: 1.0,
  created_at: '2026-01-01T00:00:00',
};

describe('ParametrosTarifa — altitud_msnm (Res CRA 750/2016)', () => {
  it('campo altitud_msnm existe (number | null)', () => {
    const conAltitud: ParametrosTarifa = { ...PARAMETROS_BASE, altitud_msnm: 2600 };
    expect(conAltitud.altitud_msnm).toBe(2600);
    const sinAltitud: ParametrosTarifa = { ...PARAMETROS_BASE, altitud_msnm: null };
    expect(sinAltitud.altitud_msnm).toBeNull();
  });

  it('altitud_msnm es opcional (backward-compat con data legacy)', () => {
    // El campo puede no estar presente: legacy data y llamadas sin
    // altitud seteada deben compilar y funcionar.
    const legacy: ParametrosTarifa = { ...PARAMETROS_BASE };
    // @ts-expect-error: confirmamos que NO existe la prop cuando no se setea
    expect(legacy.altitud_msnm).toBeUndefined();
  });
});