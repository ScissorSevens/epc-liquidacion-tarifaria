/**
 * Tests del snapshot de `otros_valores` y `saldo_anterior` en la factura.
 *
 * Refactor `factura-compliance-cleanup` Task 5 (phase-out de
 * `OtrosValoresCatalogo` y `crearOtroValor`):
 *  - `OtrosValoresCatalogo` constant removida. El catalogo regulatorio
 *    vive en la tabla SQLite `concepto_otro_valor`. La validacion del
 *    path sync de `emitirFactura` ya NO ocurre (semantica "trust the
 *    caller"; ver `emitirFacturaSync` JSDoc).
 *  - `crearOtroValor` helper removido. Los tests construyen `OtroValor`
 *    directamente.
 *  - Los tests de rechazo por codigo invalido se mueven al path async
 *    con `ConceptoOtroValorRepository` mockeado (ver
 *    `factura-catalogo-rechazo.test.ts`).
 *
 * Cubre:
 *  - Snapshot default values (`otros_valores=[]`, `saldo_anterior=0`).
 *  - Snapshot acepta `otros_valores` y los proyecta.
 *  - Snapshot acepta `saldo_anterior` y lo proyecta.
 *  - Snapshot es deepFrozen.
 *  - Hash cambia con `otros_valores` o `saldo_anterior` distintos.
 *  - `saldo_anterior` negativo lanza error.
 *  - Path sync NO valida codigo (semantica "trust the caller").
 *  - `calcularTotalFactura` formula, edge cases, total negativo.
 *  - `calcularTotalFactura` es pura.
 */
'use strict';

import {
  emitirFactura,
  calcularTotalFactura,
} from '../factura';
import type { ConceptoOtroValor, OtroValor } from '../types';
import type { EmitirFacturaInput, Factura } from '../types';
import { MENSAJES_ERROR_FACTURA } from '../types';
import { calcularHash } from '../../calculo/calculo';
import type { Liquidacion } from '../../calculo/types';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { Prestador } from '../../prestadores/types';
import type { Lectura } from '../../captura-lecturas/types';
import type { ResultadoCalculo } from '../../motor-tarifario';
import type { Hasher } from '../../shared/ports';

function fakeChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
const hasher: Hasher = { sha256: (input: string) => `hash-fake-${fakeChecksum(input)}` };

function prestadorBase(): Prestador {
  return {
    id_prestador: 1,
    codigo: '0001',
    nombre: 'Aguas del Valle S.A. E.S.P.',
    nit: '900123456-7',
    representante_legal: 'Carlos Ramírez',
    representante_legal_cedula: '79123456',
    municipio: 'Cali',
    departamento: 'Valle del Cauca',
    segmento: 2,
    num_suscriptores_urbanos: 1200,
    num_suscriptores_rurales: 800,
    contacto: 'contacto@aguasdelvalle.co',
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    aps: null,
  };
}

function suscriptorBase(): Suscriptor {
  return {
    id_suscriptor: 1,
    codigo: '00001',
    nombre_apellidos: 'María López',
    cedula: '123456789',
    municipio: 'Bogotá',
    direccion: 'Calle 5 #2-10',
    estrato: 2,
    aplica_subsidio: false,
    id_prestador: 0,
    categoria_uso: 'residencial',
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function medidorBase(): Medidor {
  return {
    id_medidor: 10,
    numero_medidor: 'MED-0001',
    id_suscriptor: 1,
    fecha_instalacion: '2024-01-15',
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function periodoBase(): Periodo {
  return {
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
}

function operarioBase(): Operario {
  return {
    id_operario: 7,
    id_prestador: 1,
    numero_cedula: '1234567890',
    nombre: 'Ana Gómez',
    email: 'ana@epc.co',
    password_hash: 'argon2id$v=19$m=...',
    rol: 'operario',
    estado: 'activo',
    dispositivo_id: 'MZ-001',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function resultadoBase(): ResultadoCalculo {
  return {
    id_prestador: 0,
    estrato: 2 as const,
    categoria_uso: 'residencial' as const,
    consumo_m3: 10,
    consumo_efectivo_m3: 10,
    bloques: [],
    cargo_fijo: 5000,
    cc_unitario: 1500,
    cc_total: 15000,
    subsidio: 0,
    contribucion: 0,
    total: 20000,
    factor_aplicado: 0,
    metadata: {
      norma_aplicada: 'X',
      acuerdo_id: null,
      parametros_id: 0,
      cmviaa_aplicado: false,
      minimo_vital_aplicado: false,
      factor_capeado: false,
      version_motor: 'X',
      calculo_timestamp: 'X',
    },
  };
}

function liquidacionBase(): Liquidacion {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
    resultado: resultadoBase(),
    estado: 'ACTIVA' as const,
  };
  return { ...base, hash: calcularHash(base, hasher) };
}

function lecturaBase(): Lectura {
  return {
    id_medidor: 10,
    id_periodo: '202601',
    id_operario: 7,
    lectura_actual: 1234,
    lectura_anterior: 1200,
    estado_validacion: 'validado',
    timestamp_captura: '2026-02-01T08:30:00.000Z',
    estado_sync: 'pendiente',
    id_prestador: 1,
  };
}

function inputBase(overrides: Partial<EmitirFacturaInput> = {}): EmitirFacturaInput {
  return {
    suscriptor: suscriptorBase(),
    medidor: medidorBase(),
    periodo: periodoBase(),
    operario: operarioBase(),
    prestador: prestadorBase(),
    lectura: lecturaBase(),
    liquidacion: liquidacionBase(),
    consumosHistoricos: [],
    fechaEmision: '2026-02-01',
    consecutivo: 1,
    ...overrides,
  };
}

describe('emitirFactura — snapshot.otros_valores y saldo_anterior', () => {
  it('snapshot.otros_valores por defecto es [] (compatibilidad legacy)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.otros_valores).toEqual([]);
  });

  it('snapshot.saldo_anterior por defecto es 0', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.saldo_anterior).toBe(0);
  });

  it('acepta input.otros_valores y los proyecta', () => {
    const otrosValores: OtroValor[] = [
      { concepto: 'RECONEXION', valor: 50000 },
      { concepto: 'FINANCIACION', valor: 100000, glosa: 'Cuota 1/12' },
    ];
    const factura = emitirFactura(inputBase({ otrosValores }), hasher);
    expect(factura.snapshot.otros_valores).toEqual(otrosValores);
  });

  it('acepta input.saldo_anterior y lo proyecta', () => {
    const factura = emitirFactura(inputBase({ saldoAnterior: 15000 }), hasher);
    expect(factura.snapshot.saldo_anterior).toBe(15000);
  });

  it('snapshot.otros_valores esta deepFrozen', () => {
    const ov: OtroValor = { concepto: 'RECONEXION', valor: 50000 };
    const factura = emitirFactura(inputBase({ otrosValores: [ov] }), hasher);
    expect(Object.isFrozen(factura.snapshot.otros_valores)).toBe(true);
    expect(Object.isFrozen(factura.snapshot.otros_valores[0])).toBe(true);
  });

  it('cambiar saldo_anterior cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase({ saldoAnterior: 15000 }), hasher);
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar otros_valores cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ otrosValores: [{ concepto: 'RECONEXION', valor: 50000 }] }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('lanza error si saldo_anterior es negativo', () => {
    expect(() =>
      emitirFactura(inputBase({ saldoAnterior: -100 }), hasher),
    ).toThrow(/saldo_anterior.*negativo/i);
  });

  // Tras Task 5 (phase-out de OtrosValoresCatalogo), el path sync
  // adopta la semantica "trust the caller": NO valida codigos. La
  // validacion ocurre exclusivamente en el path async con
  // catalogoRepo inyectado (ver factura-catalogo-rechazo.test.ts).
  it('path sync NO valida codigo desconocido (semantica trust the caller)', () => {
    const ovInvalido: OtroValor = {
      concepto: 'INVENTADO' as unknown as ConceptoOtroValor,
      valor: 1000,
    };
    // No lanza — el sync path acepta todo.
    expect(() =>
      emitirFactura(inputBase({ otrosValores: [ovInvalido] }), hasher),
    ).not.toThrow();
  });

  it('acepta otrosValores con todos los 7 codigos canonicos (path sync)', () => {
    const todosLosConceptos: ConceptoOtroValor[] = [
      'RECONEXION',
      'INTERESES_AUTORIZADOS',
      'FINANCIACION',
      'MATERIALES_ACOMETIDA',
      'AJUSTES_DEVOLUCIONES',
      'OTROS_AUTORIZADOS',
      'SALDO_ANTERIOR',
    ];
    const ovValidos: OtroValor[] = todosLosConceptos.map((concepto, i) => ({
      concepto,
      valor: 1000 + i,
    }));
    const factura = emitirFactura(inputBase({ otrosValores: ovValidos }), hasher);
    expect(factura.snapshot.otros_valores.length).toBe(todosLosConceptos.length);
  });

  it('lanza error si el total (post calculo) es negativo (TOTAL_NEGATIVO_NO_PERMITIDO)', () => {
    const resultado: ResultadoCalculo = {
      ...resultadoBase(),
      total: 100,
    };
    const liqBase = {
      id: '22222222-2222-2222-2222-222222222222',
      suscriptorId: '1',
      fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
      resultado,
      estado: 'ACTIVA' as const,
    };
    const liquidacion: Liquidacion = { ...liqBase, hash: calcularHash(liqBase, hasher) };
    const factura: Factura = emitirFactura(
      inputBase({ liquidacion, saldoAnterior: 0, otrosValores: [] }),
      hasher,
    );
    const facturaCorrupta: Factura = {
      ...factura,
      snapshot: {
        ...factura.snapshot,
        saldo_anterior: -500,
      },
    };
    expect(() => calcularTotalFactura(facturaCorrupta)).toThrow(
      MENSAJES_ERROR_FACTURA.TOTAL_NEGATIVO_NO_PERMITIDO,
    );
  });

  it('happy path: retorna total positivo con todos los componentes normales', () => {
    const resultado: ResultadoCalculo = {
      ...resultadoBase(),
      total: 10000,
    };
    const liqBase = {
      id: '33333333-3333-3333-3333-333333333333',
      suscriptorId: '1',
      fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
      resultado,
      estado: 'ACTIVA' as const,
    };
    const liquidacion: Liquidacion = { ...liqBase, hash: calcularHash(liqBase, hasher) };
    const factura = emitirFactura(
      inputBase({
        liquidacion,
        saldoAnterior: 5000,
        otrosValores: [{ concepto: 'RECONEXION', valor: 3000 }],
      }),
      hasher,
    );
    expect(calcularTotalFactura(factura)).toBe(18000);
  });
});

describe('calcularTotalFactura — formula total', () => {
  it('calcularTotalFactura = liquidacion.total + saldo_anterior + sum(otros_valores)', () => {
    const factura = emitirFactura(
      inputBase({
        saldoAnterior: 15000,
        otrosValores: [
          { concepto: 'RECONEXION', valor: 50000 },
          { concepto: 'FINANCIACION', valor: 100000, glosa: 'cuota' },
        ],
      }),
      hasher,
    );
    expect(calcularTotalFactura(factura)).toBe(185000);
  });

  it('calcularTotalFactura con saldo_anterior=0 y otros_valores=[] retorna liquidacion.total', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(calcularTotalFactura(factura)).toBe(20000);
  });

  it('calcularTotalFactura con solo saldo_anterior', () => {
    const factura = emitirFactura(inputBase({ saldoAnterior: 5000 }), hasher);
    expect(calcularTotalFactura(factura)).toBe(25000);
  });

  it('calcularTotalFactura con solo otros_valores', () => {
    const factura = emitirFactura(
      inputBase({ otrosValores: [{ concepto: 'RECONEXION', valor: 8000 }] }),
      hasher,
    );
    expect(calcularTotalFactura(factura)).toBe(28000);
  });

  it('calcularTotalFactura es pura (no muta input)', () => {
    const factura = emitirFactura(
      inputBase({ saldoAnterior: 5000, otrosValores: [{ concepto: 'RECONEXION', valor: 1000 }] }),
      hasher,
    );
    const hashAntes = factura.hash;
    const _t = calcularTotalFactura(factura);
    const hashDespues = factura.hash;
    expect(hashAntes).toBe(hashDespues);
  });
});
