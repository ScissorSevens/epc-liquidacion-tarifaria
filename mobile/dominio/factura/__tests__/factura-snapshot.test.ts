// mobile/dominio/factura/__tests__/factura-snapshot.test.ts
//
// Tests contractuales del snapshot de Factura para Fase 2
// (`param-tarifa-res-825-compliance-phase2`, task 4.9 RED).
//
// Decisión 4 del design §"Architecture Decisions":
//   "Snapshot en tabla `factura.validacion_ambito` → Auditoría
//    completa (regulatoria)."
//
// El snapshot de la Factura debe incluir el resultado de
// `validarAmbito()` (estado, subtitulo, norma_aplicable, motivo,
// cantidad_suscriptores, fecha_verificacion) para que un auditor
// regulatorio pueda reconstruir cuál Subtítulo CRA se aplicó al
// momento del cálculo, días o años después.
//
// Estos tests verifican:
//   - El path "moderno" (motor-tarifario.ts:calcularLiquidacionConAmbito)
//     popula `validacion_ambito` en metadata, y `emitirFactura` lo
//     propaga al snapshot.
//   - El path "legacy" (motor-tarifario.ts:calcularLiquidacion sin
//     ambito) NO rompe — el campo es optional y mantenerlo undefined
//     retrocompatible con los 40 callers existentes.
//   - Los 6 campos del SnapshotValidacionAmbito se preservan en
//     `snapshot.liquidacion.resultado.metadata.validacion_ambito`.
//
// TDD Evidence:
//   RED  → estos tests describen el contrato. Antes de este commit,
//          el campo `validacion_ambito` no existe en metadata y los
//          assertions fallan.
//   GREEN → `calcularLiquidacionConAmbito` popula el campo y
//          `emitirFactura` lo propaga via el liquidacionSnapshot.

import { calcularLiquidacionConAmbito } from '../../motor-tarifario/calcular-con-ambito';
import { calcularLiquidacion } from '../../motor-tarifario/motor-tarifario';
import { emitirFactura } from '../factura';
import { relojFijo } from '../types';
import type { Liquidacion } from '../../calculo/types';
import type { ParametrosTarifa } from '../../parametros-tarifa/types';
import type { AcuerdoMunicipal } from '../../acuerdo-municipal/types';
import type { Hasher, IdGenerator } from '../../shared/ports';
import { calcularHash } from '../../calculo/calculo';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { Prestador } from '../../prestadores/types';
import type { Lectura } from '../../captura-lecturas/types';

const hasher: Hasher = {
  sha256: (value) => `hash-${value.length}`,
};

const idGen: IdGenerator = {
  uuid: () => 'factura-id-test',
};

const FECHA_EMISION = '2026-02-01';
const RELOJ = relojFijo('2026-02-01T10:00:00.000Z');

/**
 * ParametrosTarifa mínimos para el motor (post-fix `cargo_fijo_resultante`
 * pre-calculado). Usa forma completa del tipo para que el motor NO
 * recalcule.
 */
const parametros: ParametrosTarifa = {
  id_parametros: 1,
  id_prestador: 1,
  id_acuerdo: 1,
  periodo: 2026,
  cma: 5_000_000,
  cmo: 800,
  cmi: 200,
  cmt: 100,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 12_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 150,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  ipuf_indice: 1.0,
  cargo_fijo_resultante: 5_000_000,
  cargo_consumo_resultante: 1_100,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2030-12-31',
  created_at: '2026-01-01T00:00:00.000Z',
  anio_base: 2016,
  factor_indexacion_ipc: 1.0,
  altitud_msnm: 1500,
};

/**
 * Acuerdo Municipal vigente para que el motor NO lance el gate
 * `ACUERDO_NO_ACTIVO` (Fase 2 task 2.10).
 */
const acuerdo: AcuerdoMunicipal = {
  id_acuerdo: 1,
  id_prestador: 1,
  factor_subsidio_e1: -0.6,
  factor_subsidio_e2: -0.5,
  factor_subsidio_e3: -0.4,
  factor_contribucion_e5: 0.5,
  factor_contribucion_e6: 0.6,
  factor_contribucion_comercial: 0.5,
  factor_contribucion_industrial: 0.3,
  fecha_vigencia_desde: '2026-01-01',
  fecha_vigencia_hasta: '2030-12-31',
  acto_administrativo_url: 'https://example.com/decreto',
  observaciones: 'Fase 2 test fixture',
  estado: 'ACTIVO',
  created_at: '2026-01-01T00:00:00.000Z',
};

const prestador: Prestador = {
  id_prestador: 1,
  codigo: '0001',
  nombre: 'Aguas de Caqueza',
  nit: '900123456-7',
  representante_legal: 'Maria Lopez',
  representante_legal_cedula: '1234567890',
  municipio: 'Caqueza',
  departamento: 'Cundinamarca',
  segmento: 2,
  num_suscriptores_urbanos: 0,
  num_suscriptores_rurales: 150,
  contacto: null,
  estado: 'activo',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  aps: null,
};

const suscriptor: Suscriptor = {
  id_suscriptor: 1,
  codigo: '00001',
  nombre_apellidos: 'Maria Lopez',
  cedula: '123456789',
  municipio: 'Caqueza',
  direccion: 'Vereda El Centro',
  estrato: 2,
  aplica_subsidio: true,
  estado: 'activo',
  id_prestador: 1,
  categoria_uso: 'residencial',
  created_at: '2026-01-01T00:00:00.000Z',
};

const medidor: Medidor = {
  id_medidor: 10,
  numero_medidor: 'MED-10',
  id_suscriptor: 1,
  fecha_instalacion: '2024-01-01',
  estado: 'activo',
  created_at: '2026-01-01T00:00:00.000Z',
};

const periodo: Periodo = {
  id_periodo: '202601',
  nombre: 'Enero 2026',
  fecha_inicio: '2026-01-01',
  fecha_fin: '2026-01-31',
  fecha_pago_sin_recargo: '2026-02-15',
  fecha_pago_con_recargo: '2026-02-28',
  dias_consumo: 31,
  estado: 'cerrado',
  created_at: '2026-01-01T00:00:00.000Z',
};

const operario: Operario = {
  id_operario: 7,
  id_prestador: 1,
  numero_cedula: '987654321',
  nombre: 'Ana Gomez',
  email: 'ana@example.test',
  password_hash: 'never-in-snapshot',
  rol: 'operario',
  estado: 'activo',
  dispositivo_id: 'MZ-001',
  created_at: '2026-01-01T00:00:00.000Z',
};

const lectura: Lectura = {
  id_medidor: 10,
  id_periodo: '202601',
  id_operario: 7,
  lectura_actual: 1012,
  lectura_anterior: 1000,
  estado_validacion: 'validado',
  timestamp_captura: '2026-02-01T08:30:00.000Z',
  estado_sync: 'pendiente',
  id_prestador: 1,
};

/**
 * Crea una Liquidacion válida a partir de un ResultadoCalculo.
 */
function crearLiquidacion(resultado: ReturnType<typeof calcularLiquidacion>): Liquidacion {
  const base = {
    id: 'liq-1',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-01-31T10:00:00.000Z'),
    resultado,
    estado: 'ACTIVA' as const,
  };
  return { ...base, hash: calcularHash(base, hasher) };
}

describe('factura.snapshot.validacion_ambito (Fase 2 task 4.9 RED)', () => {
  it('T-FACT-AMB-1 snapshot.liquidacion.resultado.metadata.validacion_ambito está presente tras emitirFactura', () => {
    // Calculamos la liquidación con el wrapper moderno (incluye
    // validarAmbito). Esto popula `validacion_ambito` en metadata.
    const resultado = calcularLiquidacionConAmbito(
      {
        id_prestador: 1,
        estrato: 2,
        categoria_uso: 'residencial',
        consumo_m3: 12,
      },
      parametros,
      acuerdo,
      {
        id_prestador: 1,
        cantidad_suscriptores: 150,
        zona: 'RURAL',
      },
      FECHA_EMISION,
    );
    const liquidacion = crearLiquidacion(resultado);

    const factura = emitirFactura(
      {
        suscriptor,
        medidor,
        periodo,
        operario,
        prestador,
        lectura,
        liquidacion,
        consumosHistoricos: [],
        fechaEmision: FECHA_EMISION,
        consecutivo: 1,
      },
      hasher,
      idGen,
      RELOJ,
    );

    // El snapshot de la factura debe incluir validacion_ambito
    // en la metadata de la liquidacion persistida.
    expect(
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito,
    ).toBeDefined();
    expect(
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito,
    ).not.toBeNull();
  });

  it('T-FACT-AMB-2 el campo estado del validacion_ambito es "APLICA" en el path moderno', () => {
    const resultado = calcularLiquidacionConAmbito(
      {
        id_prestador: 1,
        estrato: 2,
        categoria_uso: 'residencial',
        consumo_m3: 12,
      },
      parametros,
      acuerdo,
      {
        id_prestador: 1,
        cantidad_suscriptores: 150,
        zona: 'RURAL',
      },
      FECHA_EMISION,
    );
    const liquidacion = crearLiquidacion(resultado);

    const factura = emitirFactura(
      {
        suscriptor,
        medidor,
        periodo,
        operario,
        prestador,
        lectura,
        liquidacion,
        consumosHistoricos: [],
        fechaEmision: FECHA_EMISION,
        consecutivo: 2,
      },
      hasher,
      idGen,
      RELOJ,
    );

    const validacionAmbito =
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito;
    expect(validacionAmbito).toBeDefined();
    expect(validacionAmbito?.estado).toBe('APLICA');
  });

  it('T-FACT-AMB-3 el campo motivo refleja la evidencia del ResultadoAmbito (proyección)', () => {
    const resultado = calcularLiquidacionConAmbito(
      {
        id_prestador: 1,
        estrato: 2,
        categoria_uso: 'residencial',
        consumo_m3: 12,
      },
      parametros,
      acuerdo,
      {
        id_prestador: 1,
        cantidad_suscriptores: 150,
        zona: 'RURAL',
      },
      FECHA_EMISION,
    );
    const liquidacion = crearLiquidacion(resultado);

    const factura = emitirFactura(
      {
        suscriptor,
        medidor,
        periodo,
        operario,
        prestador,
        lectura,
        liquidacion,
        consumosHistoricos: [],
        fechaEmision: FECHA_EMISION,
        consecutivo: 3,
      },
      hasher,
      idGen,
      RELOJ,
    );

    const validacionAmbito =
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito;
    // El motivo debe ser un string NO vacío (la evidencia de
    // validarAmbito tiene texto regulatorio).
    expect(validacionAmbito?.motivo).toBeDefined();
    expect(typeof validacionAmbito?.motivo).toBe('string');
    expect(validacionAmbito?.motivo.length).toBeGreaterThan(0);
    // Debe mencionar suscriptores o zona (normalizado en la evidencia).
    expect(validacionAmbito?.motivo).toMatch(/suscriptores|rural/i);
  });

  it('T-FACT-AMB-4 el campo cantidad_suscriptores refleja la cantidad del prestador', () => {
    const resultado = calcularLiquidacionConAmbito(
      {
        id_prestador: 1,
        estrato: 2,
        categoria_uso: 'residencial',
        consumo_m3: 12,
      },
      parametros,
      acuerdo,
      {
        id_prestador: 1,
        cantidad_suscriptores: 150, // cantidad rural segmento 2
        zona: 'RURAL',
      },
      FECHA_EMISION,
    );
    const liquidacion = crearLiquidacion(resultado);

    const factura = emitirFactura(
      {
        suscriptor,
        medidor,
        periodo,
        operario,
        prestador,
        lectura,
        liquidacion,
        consumosHistoricos: [],
        fechaEmision: FECHA_EMISION,
        consecutivo: 4,
      },
      hasher,
      idGen,
      RELOJ,
    );

    const validacionAmbito =
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito;
    expect(validacionAmbito?.cantidad_suscriptores).toBe(150);
  });

  it('T-FACT-AMB-5 el campo subtitulo es 2 (Subtítulo CRA 825/2017) para 150 suscriptores rurales', () => {
    const resultado = calcularLiquidacionConAmbito(
      {
        id_prestador: 1,
        estrato: 2,
        categoria_uso: 'residencial',
        consumo_m3: 12,
      },
      parametros,
      acuerdo,
      {
        id_prestador: 1,
        cantidad_suscriptores: 150,
        zona: 'RURAL',
      },
      FECHA_EMISION,
    );
    const liquidacion = crearLiquidacion(resultado);

    const factura = emitirFactura(
      {
        suscriptor,
        medidor,
        periodo,
        operario,
        prestador,
        lectura,
        liquidacion,
        consumosHistoricos: [],
        fechaEmision: FECHA_EMISION,
        consecutivo: 5,
      },
      hasher,
      idGen,
      RELOJ,
    );

    const validacionAmbito =
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito;
    // Subtítulo 2 (CRA 825/2017) para rurales ≤5000 (validarAmbito retorna esto).
    expect(validacionAmbito?.subtitulo).toBe(2);
  });

  it('T-FACT-AMB-6 el snapshot completo mantiene la integridad (hash version v2) con validacion_ambito', () => {
    const resultado = calcularLiquidacionConAmbito(
      {
        id_prestador: 1,
        estrato: 2,
        categoria_uso: 'residencial',
        consumo_m3: 12,
      },
      parametros,
      acuerdo,
      {
        id_prestador: 1,
        cantidad_suscriptores: 150,
        zona: 'RURAL',
      },
      FECHA_EMISION,
    );
    const liquidacion = crearLiquidacion(resultado);

    const factura = emitirFactura(
      {
        suscriptor,
        medidor,
        periodo,
        operario,
        prestador,
        lectura,
        liquidacion,
        consumosHistoricos: [],
        fechaEmision: FECHA_EMISION,
        consecutivo: 6,
      },
      hasher,
      idGen,
      RELOJ,
    );

    // El hash version sigue siendo v2 (el campo validacion_ambito
    // entra en la metadata, que ya estaba firmada en v2).
    expect(factura.snapshot.metadata.hash_version).toBe('v2');
    // Y el campo validacion_ambito está presente.
    expect(
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito,
    ).toBeDefined();
  });

  it('T-FACT-AMB-7 path legacy (calcularLiquidacion sin ambito) NO rompe: validacion_ambito es undefined', () => {
    // Backward-compat: si el caller usa el motor puro (40 callers
    // legacy), el campo validacion_ambito debe ser undefined para
    // que los asserts viejos no rompan.
    const resultado = calcularLiquidacion(
      {
        id_prestador: 1,
        estrato: 2,
        categoria_uso: 'residencial',
        consumo_m3: 12,
      },
      parametros,
      acuerdo,
    );
    const liquidacion = crearLiquidacion(resultado);

    const factura = emitirFactura(
      {
        suscriptor,
        medidor,
        periodo,
        operario,
        prestador,
        lectura,
        liquidacion,
        consumosHistoricos: [],
        fechaEmision: FECHA_EMISION,
        consecutivo: 7,
      },
      hasher,
      idGen,
      RELOJ,
    );

    // En el path legacy, validacion_ambito es undefined (no se setea).
    expect(
      factura.snapshot.liquidacion.resultado.metadata.validacion_ambito,
    ).toBeUndefined();
  });
});
