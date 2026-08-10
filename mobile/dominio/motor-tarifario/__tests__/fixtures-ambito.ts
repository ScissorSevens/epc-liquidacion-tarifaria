/**
 * Fixtures reusables para tests de `calcularLiquidacionConAmbito`.
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (task 2.7).
 */

import type { AcuerdoMunicipal, ParametrosTarifa, EntradaCalculo } from '../types';
import type { CategoriaUso } from '../categorias-uso';

const PARAMETROS_BASE: ParametrosTarifa = {
  id_parametros: 1,
  id_prestador: 0,
  id_acuerdo: 1,
  periodo: 2026,
  cma: 8000,
  cmo: 1200,
  cmi: 200,
  cmt: 100,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 100_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 3000,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  ipuf_indice: 1.0,
  cargo_fijo_resultante: 0,
  cargo_consumo_resultante: 0,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2026-12-31',
  created_at: '2026-01-01T00:00:00',
  anio_base: 2016,
  factor_indexacion_ipc: 1.0,
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
  acto_administrativo_url: 'https://ejemplo/decreto.pdf',
  observaciones: null,
  estado: 'ACTIVO',
  created_at: '2026-01-01T00:00:00',
};

const CATEGORIA_RESIDENCIAL: CategoriaUso = 'residencial';
const ESTRATO_DEFAULT = 3 as 1 | 2 | 3 | 4 | 5 | 6;

export interface EntradaConFecha extends EntradaCalculo {
  readonly fecha_emision: string;
}

function entradaBaseConFecha(overrides: Partial<EntradaCalculo> = {}): EntradaConFecha {
  return {
    id_prestador: 0,
    consumo_m3: 18,
    estrato: ESTRATO_DEFAULT,
    categoria_uso: CATEGORIA_RESIDENCIAL,
    fecha_emision: '2026-08-10T10:00:00Z',
    ...overrides,
  };
}

export { PARAMETROS_BASE, ACUERDO_BASE, entradaBaseConFecha as entradaBase, type Prestador };
import type { PrestadorAmbitoInfo as Prestador } from '../../ambito-tarifario/types';
