// Smoke del dominio puro para la app movil.
//
// Esta funcion es Node-importable (no toca expo-sqlite ni APIs nativas)
// y la usa el wiring test del root para confirmar que el path mapping
// `@dominio/*` resuelve correctamente desde mobile/. Tambien la consume
// el bootstrap real en runtime para validar que el motor tarifario esta
// disponible antes de cablear las repos SQLite.

import { calcularLiquidacion } from '@dominio/motor-tarifario';
import type { EntradaCalculo, ParametrosTarifa, AcuerdoMunicipal } from '@dominio/motor-tarifario';
import type { Suscriptor } from '@dominio/suscriptores/types';

export interface ResultadoSmokeDominio {
  estado: 'OK' | 'ERROR';
  mensaje: string;
  timestamp: string;
  smokeMotorTarifario?: {
    consumoM3: number;
    totalCalculado: number;
  };
}

const PARAMETROS_SMOKE: ParametrosTarifa = {
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
  agua_suministrada_m3_anio: 500_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 3000,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2026-12-31',
  created_at: '2026-01-01T00:00:00',
};

const ACUERDO_SMOKE: AcuerdoMunicipal = {
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

const SUSCRIPTOR_SMOKE: Suscriptor = {
  id_suscriptor: 1,
  codigo: 'S001',
  nombre_apellidos: 'Test',
  cedula: '123',
  municipio: 'Bog',
  direccion: 'Calle 1',
  estrato: 3,
  aplica_subsidio: false,
  estado: 'activo',
  created_at: '2026-01-01T00:00:00',
  id_prestador: 0,
  categoria_uso: 'residencial',
};

/**
 * Corre un calculo trivial del motor tarifario para confirmar que el
 * wiring del dominio funciona en runtime (no solo en tipos). Devuelve
 * un objeto serializable para mostrar en `Alert.alert` en RN.
 */
export function smokeDominio(): ResultadoSmokeDominio {
  try {
    const entrada: EntradaCalculo = {
      id_prestador: 0,
      consumo_m3: 15, // 1015 - 1000
      estrato: 3,
      categoria_uso: 'residencial',
    };
    const resultado = calcularLiquidacion(entrada, PARAMETROS_SMOKE, ACUERDO_SMOKE);

    return {
      estado: 'OK',
      mensaje: 'AquaServices - Dominio cargado correctamente',
      timestamp: new Date().toISOString(),
      smokeMotorTarifario: {
        consumoM3: resultado.consumo_m3,
        totalCalculado: resultado.total,
      },
    };
  } catch (error) {
    return {
      estado: 'ERROR',
      mensaje: `Fallo el smoke del dominio: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// Suppress unused param warning
void SUSCRIPTOR_SMOKE;
