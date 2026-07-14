// Los tests de inmutabilidad (factura entera congelada) dependen de strict
// mode para que `Object.freeze()` arroje TypeError al intentar mutar.
// Sin esto, Babel + babel-preset-expo no emiten 'use strict' en archivos TS
// y la mutación falla silenciosamente, haciendo que `toThrow(TypeError)` falle.
'use strict';

/**
 * Tests del módulo FACTURA — funciones puras.
 *
 * Tests importan `MENSAJES_ERROR_FACTURA.CLAVE` — nunca literales.
 * Inputs construidos inline por test desde una base mínima válida.
 */

import { emitirFactura, anularFactura, esVencida, esTransicionLegal } from '../factura';
import { MENSAJES_ERROR_FACTURA, type ConsumoHistorico, type EmitirFacturaInput, type EstadoFactura, type Factura } from '../types';
import { calcularHash } from '../../calculo/calculo';
import type { Liquidacion } from '../../calculo/types';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { ResultadoCalculo } from '../../motor-tarifario';
import type { Hasher } from '../../shared/ports';

// Fake hasher determinista por contenido (mismo input → mismo output, sin crypto real).
function fakeChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
const hasher: Hasher = { sha256: (input: string) => `hash-fake-${fakeChecksum(input)}` };

// Helpers locales: construyen aggregates mínimos válidos para tests.
// NO son shared builders: cada test compone su input adaptándolos inline.
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

function resultadoCalculoBase(): ResultadoCalculo {
  return {
    id_prestador: 0, estrato: 4 as const, categoria_uso: 'residencial' as const, consumo_m3: 10, consumo_efectivo_m3: 10, bloques: [],
    cargo_fijo: 5000, cc_unitario: 1500, cc_total: 15000,
    subsidio: 0, contribucion: 0, total: 20000, factor_aplicado: 0, metadata: { norma_aplicada: 'X', acuerdo_id: null, parametros_id: 0, cmviaa_aplicado: false, minimo_vital_aplicado: false, factor_capeado: false, version_motor: 'X', calculo_timestamp: 'X' },
  };
}

function liquidacionBase(): Liquidacion {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
    resultado: resultadoCalculoBase(),
    estado: 'ACTIVA' as const,
  };
  return { ...base, hash: calcularHash(base, hasher) };
}

function inputBase(): EmitirFacturaInput {
  return {
    suscriptor: suscriptorBase(),
    medidor: medidorBase(),
    periodo: periodoBase(),
    operario: operarioBase(),
    liquidacion: liquidacionBase(),
    consumosHistoricos: [],
    fechaEmision: '2026-02-01',
    consecutivo: 1,
  };
}

/**
 * Construye una Factura en estado EMITIDA a partir del happy path.
 * `emitirFactura` siempre retorna BORRADOR, y la transición a EMITIDA
 * vive en `repo.actualizar` (Phase 6). Para los tests puros de Phase 4
 * armamos manualmente el equivalente a "ya emitida" — sin tocar el repo.
 */
function facturaEmitidaBase(overrides: Partial<Factura> = {}): Factura {
  const borrador = emitirFactura(inputBase(), hasher);
  return Object.freeze({
    ...borrador,
    estado: 'EMITIDA' as const,
    ...overrides,
  });
}

describe('emitirFactura — happy path', () => {
  it('devuelve Factura con estado BORRADOR', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.estado).toBe('BORRADOR');
  });

  it('formatea numero_factura como {dispositivo_id}-{consecutivo} con padding', () => {
    const input = inputBase();
    const operario = { ...operarioBase(), dispositivo_id: 'MZ-001' };
    const factura = emitirFactura({ ...input, operario, consecutivo: 2981 }, hasher);
    expect(factura.numero_factura).toBe('MZ-001-2981');
  });

  it('snapshotea suscriptor (codigo, nombre, direccion, estrato, id_prestador, categoria_uso) y lo congela', () => {
    const suscriptor: Suscriptor = {
      ...suscriptorBase(),
      codigo: '00042',
      nombre_apellidos: 'Carlos Ruiz',
      direccion: 'Carrera 7 #14-30',
      estrato: 3,
    };
    const factura = emitirFactura({ ...inputBase(), suscriptor }, hasher);
    expect(factura.snapshot.suscriptor).toEqual({
      codigo: '00042',
      nombre_apellidos: 'Carlos Ruiz',
      direccion: 'Carrera 7 #14-30',
      estrato: 3,
      id_prestador: suscriptor.id_prestador,
      categoria_uso: suscriptor.categoria_uso,
    });
    expect(Object.isFrozen(factura.snapshot.suscriptor)).toBe(true);
  });

  it('snapshotea medidor (numero_medidor) y lo congela', () => {
    const medidor: Medidor = { ...medidorBase(), numero_medidor: 'MED-9999' };
    const factura = emitirFactura({ ...inputBase(), medidor }, hasher);
    expect(factura.snapshot.medidor).toEqual({ numero_medidor: 'MED-9999' });
    expect(Object.isFrozen(factura.snapshot.medidor)).toBe(true);
  });

  it('snapshotea periodo (id, fechas, dias_consumo) y lo congela', () => {
    const periodo: Periodo = {
      ...periodoBase(),
      id_periodo: '202603',
      fecha_inicio: '2026-03-01',
      fecha_fin: '2026-03-31',
      fecha_pago_sin_recargo: '2026-04-15',
      fecha_pago_con_recargo: '2026-04-30',
      dias_consumo: 30,
    };
    const factura = emitirFactura({ ...inputBase(), periodo, fechaEmision: '2026-04-01' }, hasher);
    expect(factura.snapshot.periodo).toEqual({
      id_periodo: '202603',
      fecha_inicio: '2026-03-01',
      fecha_fin: '2026-03-31',
      fecha_pago_sin_recargo: '2026-04-15',
      fecha_pago_con_recargo: '2026-04-30',
      dias_consumo: 30,
    });
    expect(Object.isFrozen(factura.snapshot.periodo)).toBe(true);
  });

  it('snapshotea operario (id, nombre, dispositivo_id) y lo congela', () => {
    const operario: Operario = {
      ...operarioBase(),
      id_operario: 42,
      nombre: 'Pedro Sánchez',
      dispositivo_id: 'MZ-007',
    };
    const factura = emitirFactura({ ...inputBase(), operario }, hasher);
    expect(factura.snapshot.operario).toEqual({
      id_operario: 42,
      nombre: 'Pedro Sánchez',
      dispositivo_id: 'MZ-007',
    });
    expect(Object.isFrozen(factura.snapshot.operario)).toBe(true);
  });

  it('snapshotea liquidacion (id, hash, resultado completo) y la congela', () => {
    const resultado: ResultadoCalculo = {
      id_prestador: 0,
      estrato: 5 as const,
      categoria_uso: 'residencial' as const,
      consumo_m3: 22,
      consumo_efectivo_m3: 22,
      bloques: [],
      cargo_fijo: 5500,
      cc_unitario: 1500,
      cc_total: 33000,
      subsidio: 0,
      contribucion: 4250,
      total: 46750,
      factor_aplicado: 0.10,
      metadata: { norma_aplicada: 'X', acuerdo_id: null, parametros_id: 0, cmviaa_aplicado: false, minimo_vital_aplicado: false, factor_capeado: false, version_motor: 'X', calculo_timestamp: 'X' },
    };
    const base = {
      ...liquidacionBase(),
      id: '99999999-9999-9999-9999-999999999999',
      resultado,
    };
    const liquidacion: Liquidacion = { ...base, hash: calcularHash(base, hasher) };
    const factura = emitirFactura({ ...inputBase(), liquidacion }, hasher);
    expect(factura.snapshot.liquidacion).toEqual({
      id: '99999999-9999-9999-9999-999999999999',
      hash: liquidacion.hash,
      resultado,
    });
    expect(Object.isFrozen(factura.snapshot.liquidacion)).toBe(true);
    expect(Object.isFrozen(factura.snapshot.liquidacion.resultado)).toBe(true);
  });

  it('snapshotea consumosHistoricos (array de ConsumoHistorico) y los congela', () => {
    const consumosHistoricos: ConsumoHistorico[] = [
      { id_periodo: '202601', consumo_m3: 18, total_facturado: 38000 },
      { id_periodo: '202602', consumo_m3: 21, total_facturado: 42500 },
      { id_periodo: '202603', consumo_m3: 19, total_facturado: 39250 },
    ];
    const factura = emitirFactura({ ...inputBase(), consumosHistoricos }, hasher);
    expect(factura.snapshot.consumosHistoricos).toEqual(consumosHistoricos);
    expect(Object.isFrozen(factura.snapshot.consumosHistoricos)).toBe(true);
    expect(Object.isFrozen(factura.snapshot.consumosHistoricos[0])).toBe(true);
  });

  it('calcula hash reproducible y determinístico sobre snapshot+numero+fechaEmision usando el Hasher inyectado', () => {
    const input = inputBase();
    const a = emitirFactura(input, hasher);
    const b = emitirFactura(input, hasher);
    expect(a.hash).toBe(b.hash);
    // El formato SHA-256 (hex 64 chars) es responsabilidad del adapter Hasher,
    // testeado en src/shared/adapters/__tests__/hasher-js.test.ts.
    // Acá solo validamos que factura usa el Hasher inyectado y produce hash no vacío.
    expect(a.hash).toMatch(/^hash-fake-/);
  });

  it('hash cambia si cambia cualquier campo del snapshot', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura({ ...inputBase(), consecutivo: 2 }, hasher);
    expect(a.hash).not.toBe(b.hash);
  });

  it('factura entera está congelada (mutación lanza en strict)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(Object.isFrozen(factura)).toBe(true);
    expect(Object.isFrozen(factura.snapshot)).toBe(true);
    expect(() => {
      (factura as { estado: string }).estado = 'EMITIDA';
    }).toThrow(TypeError);
  });

  it('snapshotea observaciones cuando se proveen', () => {
    const factura = emitirFactura({ ...inputBase(), observaciones: 'Lectura tomada con cliente presente' }, hasher);
    expect(factura.snapshot.observaciones).toBe('Lectura tomada con cliente presente');
  });

  it('omite observaciones del snapshot cuando no se proveen', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.observaciones).toBeUndefined();
  });
});

describe('emitirFactura — validaciones de invariantes', () => {
  it('rechaza si liquidacion.estado !== ACTIVA (LIQUIDACION_NO_ACTIVA)', () => {
    const base = liquidacionBase();
    const anulada = { ...base, estado: 'ANULADA' as const };
    const liquidacion: Liquidacion = { ...anulada, hash: calcularHash(anulada, hasher) };
    expect(() => emitirFactura({ ...inputBase(), liquidacion }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.LIQUIDACION_NO_ACTIVA,
    );
  });

  it('rechaza si hash de liquidacion no coincide con recalculo (LIQUIDACION_INTEGRIDAD_ROTA)', () => {
    const liquidacion: Liquidacion = { ...liquidacionBase(), hash: 'hash-manipulado-1234' };
    expect(() => emitirFactura({ ...inputBase(), liquidacion }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.LIQUIDACION_INTEGRIDAD_ROTA,
    );
  });

  it('rechaza si suscriptor.estado !== activo (SUSCRIPTOR_NO_ACTIVO)', () => {
    const suscriptor: Suscriptor = { ...suscriptorBase(), estado: 'suspendido' };
    expect(() => emitirFactura({ ...inputBase(), suscriptor }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.SUSCRIPTOR_NO_ACTIVO,
    );
  });

  it('rechaza si medidor.id_suscriptor !== suscriptor.id_suscriptor (MEDIDOR_NO_PERTENECE_A_SUSCRIPTOR)', () => {
    const medidor: Medidor = { ...medidorBase(), id_suscriptor: 999 };
    expect(() => emitirFactura({ ...inputBase(), medidor }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.MEDIDOR_NO_PERTENECE_A_SUSCRIPTOR,
    );
  });

  it('rechaza si medidor.estado !== activo (MEDIDOR_NO_ACTIVO)', () => {
    const medidor: Medidor = { ...medidorBase(), estado: 'reemplazado' };
    expect(() => emitirFactura({ ...inputBase(), medidor }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.MEDIDOR_NO_ACTIVO,
    );
  });

  it('rechaza si periodo.estado === abierto (PERIODO_NO_FACTURABLE)', () => {
    const periodo: Periodo = { ...periodoBase(), estado: 'abierto' };
    expect(() => emitirFactura({ ...inputBase(), periodo }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.PERIODO_NO_FACTURABLE,
    );
  });

  it('rechaza si fechaEmision < periodo.fecha_fin (FECHA_EMISION_ANTES_FIN_PERIODO)', () => {
    // periodoBase: fecha_fin = '2026-01-31' → emitir el 2026-01-15 es prematuro
    expect(() => emitirFactura({ ...inputBase(), fechaEmision: '2026-01-15' }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.FECHA_EMISION_ANTES_FIN_PERIODO,
    );
  });

  it('rechaza si operario.estado !== activo (OPERARIO_NO_ACTIVO)', () => {
    const operario: Operario = { ...operarioBase(), estado: 'inactivo' };
    expect(() => emitirFactura({ ...inputBase(), operario }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.OPERARIO_NO_ACTIVO,
    );
  });

  it('rechaza si operario no tiene dispositivo_id (OPERARIO_SIN_DISPOSITIVO)', () => {
    const { dispositivo_id: _omit, ...rest } = operarioBase();
    const operario = rest as Operario;
    expect(() => emitirFactura({ ...inputBase(), operario }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.OPERARIO_SIN_DISPOSITIVO,
    );
  });

  it('rechaza si consumosHistoricos.length > 6 (CONSUMO_HISTORICO_INVALIDO)', () => {
    const consumosHistoricos: ConsumoHistorico[] = Array.from({ length: 7 }, (_, i) => ({
      id_periodo: `20260${i + 1}`,
      consumo_m3: 10 + i,
      total_facturado: 1000 * (i + 1),
    }));
    expect(() => emitirFactura({ ...inputBase(), consumosHistoricos }, hasher)).toThrow(
      MENSAJES_ERROR_FACTURA.CONSUMO_HISTORICO_INVALIDO,
    );
  });
});


describe('anularFactura — funcion pura', () => {
  it('desde EMITIDA devuelve nueva Factura con estado ANULADA, motivo y fecha_anulacion', () => {
    const original = facturaEmitidaBase();
    const anulada = anularFactura(original, 'Lectura mal tomada en campo', '2026-02-10');
    expect(anulada.estado).toBe('ANULADA');
    expect(anulada.motivo_anulacion).toBe('Lectura mal tomada en campo');
    expect(anulada.fecha_anulacion).toBe('2026-02-10');
    expect(anulada.id).toBe(original.id);
    expect(anulada.numero_factura).toBe(original.numero_factura);
  });

  it('rechaza si factura no esta en EMITIDA (BORRADOR lanza FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL)', () => {
    const borrador = emitirFactura(inputBase(), hasher); // estado BORRADOR
    expect(() => anularFactura(borrador, 'motivo', '2026-02-10')).toThrow(
      MENSAJES_ERROR_FACTURA.FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL,
    );
  });

  it('rechaza si factura ya esta ANULADA (FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL)', () => {
    const yaAnulada = facturaEmitidaBase({ estado: 'ANULADA' });
    expect(() => anularFactura(yaAnulada, 'motivo', '2026-02-10')).toThrow(
      MENSAJES_ERROR_FACTURA.FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL,
    );
  });
});


describe('esVencida — funcion pura', () => {
  it('es true cuando estado EMITIDA y fechaActual > fecha_pago_con_recargo', () => {
    // periodoBase fecha_pago_con_recargo = '2026-02-28'
    const factura = facturaEmitidaBase();
    expect(esVencida(factura, '2026-03-01')).toBe(true);
  });

  it('es false cuando fechaActual === fecha_pago_con_recargo (no estricto >)', () => {
    const factura = facturaEmitidaBase();
    expect(esVencida(factura, '2026-02-28')).toBe(false);
  });

  it('es false cuando fechaActual < fecha_pago_con_recargo', () => {
    const factura = facturaEmitidaBase();
    expect(esVencida(factura, '2026-02-15')).toBe(false);
  });

  it('es false cuando estado === PAGADA aunque fecha actual supere recargo', () => {
    const facturaPagada = facturaEmitidaBase({ estado: 'PAGADA' });
    expect(esVencida(facturaPagada, '2026-12-31')).toBe(false);
  });
});

describe('esTransicionLegal — transiciones permitidas desde BORRADOR', () => {
  it('BORRADOR → EMITIDA es legal', () => {
    expect(esTransicionLegal('BORRADOR', 'EMITIDA')).toBe(true);
  });

  it('BORRADOR → ANULADA es legal', () => {
    expect(esTransicionLegal('BORRADOR', 'ANULADA')).toBe(true);
  });
});

describe('esTransicionLegal — transiciones permitidas desde EMITIDA', () => {
  it('EMITIDA → PAGADA es legal', () => {
    expect(esTransicionLegal('EMITIDA', 'PAGADA')).toBe(true);
  });

  it('EMITIDA → ANULADA es legal', () => {
    expect(esTransicionLegal('EMITIDA', 'ANULADA')).toBe(true);
  });
});

describe('MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL', () => {
  it('está definido como string no vacío en el catálogo', () => {
    expect(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL).toBeTruthy();
    expect(typeof MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL).toBe('string');
  });

  it('menciona la palabra "transición" (ES) para que el operario entienda', () => {
    expect(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL).toMatch(/transici[oó]n/i);
  });
});

describe('esTransicionLegal — transiciones ilegales (estados terminales y retrocesos)', () => {
  // Spec persistencia-sqlite/factura/ADDED-R1: PAGADA y ANULADA son terminales,
  // y nadie puede volver a BORRADOR desde ningún estado.
  const ilegales: ReadonlyArray<[EstadoFactura, EstadoFactura]> = [
    ['ANULADA', 'ANULADA'],
    ['ANULADA', 'EMITIDA'],
    ['ANULADA', 'PAGADA'],
    ['PAGADA', 'ANULADA'],
    ['PAGADA', 'EMITIDA'],
    ['PAGADA', 'PAGADA'],
    ['EMITIDA', 'BORRADOR'],
    ['EMITIDA', 'EMITIDA'],
    ['PAGADA', 'BORRADOR'],
    ['ANULADA', 'BORRADOR'],
    ['BORRADOR', 'BORRADOR'],
    ['BORRADOR', 'PAGADA'],
  ];

  it.each(ilegales)('%s → %s es ilegal', (actual, nueva) => {
    expect(esTransicionLegal(actual, nueva)).toBe(false);
  });
});
