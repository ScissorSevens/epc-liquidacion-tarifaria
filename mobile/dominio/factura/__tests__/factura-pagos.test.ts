/**
 * Tests de los helpers de verificacion y pago de la factura.
 *
 * Cubre:
 *  - calcularCodigoVerificacion(factura): SHA-256 truncado a 16 chars.
 *  - generarReferenciaPago(): UUID v4.
 *  - generarQrPago(factura): string `${prefijo}|${referencia_pago}|${timestamp}`.
 *  - Persistencia en el snapshot y propagacion a campos top-level.
 *  - version_tarifa_aplicada copiada de metadata.version_motor.
 *  - Tests de determinismo (calcularCodigoVerificacion es puro).
 *  - Tests del formato QR para banca virtual.
 */
'use strict';

import {
  emitirFactura,
} from '../factura';
import {
  calcularCodigoVerificacion,
  generarReferenciaPago,
  generarQrPago,
  esCodigoVerificacionValido,
} from '../pagos';
import type { EmitirFacturaInput, Factura } from '../types';
import { calcularHash } from '../../calculo/calculo';
import type { Liquidacion } from '../../calculo/types';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { Prestador } from '../../prestadores/types';
import type { Lectura } from '../../captura-lecturas/types';
import type { ResultadoCalculo } from '../../motor-tarifario';
import type { Hasher, IdGenerator } from '../../shared/ports';

function fakeChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
const hasher: Hasher = { sha256: (input: string) => `hash-fake-${fakeChecksum(input)}` };

let uuidCounter = 0;
const idGen: IdGenerator = {
  uuid: () => {
    uuidCounter += 1;
    const hex = uuidCounter.toString(16).padStart(12, '0');
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-a${hex.slice(0, 3)}-${hex.slice(0, 12)}`;
  },
};

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
      version_motor: 'v825-2017-1.0',
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

describe('calcularCodigoVerificacion — helper puro', () => {
  it('retorna string de 10 chars base36 derivado del hash canónico', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const codigo = calcularCodigoVerificacion(factura);
    expect(codigo).toHaveLength(10);
    expect(esCodigoVerificacionValido(codigo)).toBe(true);
  });

  it('solo usa chars base36 (0-9, A-Z)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const codigo = calcularCodigoVerificacion(factura);
    expect(codigo).toMatch(/^[0-9A-Z]{10}$/);
  });

  it('misma factura produce mismo codigo (puro y determinista)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const a = calcularCodigoVerificacion(factura);
    const b = calcularCodigoVerificacion(factura);
    expect(a).toBe(b);
  });

  it('cambiar el hash de la factura cambia el codigo', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const codigoOriginal = calcularCodigoVerificacion(factura);
    const facturaModificada: Factura = { ...factura, hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' };
    const codigoModificado = calcularCodigoVerificacion(facturaModificada);
    expect(codigoOriginal).not.toBe(codigoModificado);
  });

  it('distinto prestador → distinto codigo', () => {
    const prestador2: Prestador = { ...prestadorBase(), nombre: 'OTRO PRESTADOR' };
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase({ prestador: prestador2 }), hasher);
    expect(calcularCodigoVerificacion(a)).not.toBe(calcularCodigoVerificacion(b));
  });

  it('el codigo tiene siempre exactamente 10 chars (longitud normativa)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const codigo = calcularCodigoVerificacion(factura);
    expect(codigo.length).toBe(10);
    // Validar tambien con hash vacio (caso degenerado)
    const codigoVacio = calcularCodigoVerificacion({ ...factura, hash: '' });
    expect(codigoVacio.length).toBe(10);
  });
});

describe('generarReferenciaPago — formato {prestador}-{periodo}-{consecutivo}-{checksum}', () => {
  it('genera string con 4 segmentos separados por guion', () => {
    const factura = emitirFactura(inputBase({ consecutivo: 42 }), hasher);
    const ref = generarReferenciaPago(factura, 42, hasher);
    expect(ref).toMatch(/^.+-.+-.+-.{4}$/);
  });

  it('primer segmento es id_prestador (1 = EPC del test base)', () => {
    const factura = emitirFactura(inputBase({ consecutivo: 7 }), hasher);
    const ref = generarReferenciaPago(factura, 7, hasher);
    expect(ref.split('-')[0]).toBe('1');
  });

  it('segundo segmento es id_periodo (202601 del periodo base)', () => {
    const factura = emitirFactura(inputBase({ consecutivo: 1 }), hasher);
    const ref = generarReferenciaPago(factura, 1, hasher);
    expect(ref.split('-')[1]).toBe('202601');
  });

  it('tercer segmento es el consecutivo', () => {
    const factura = emitirFactura(inputBase({ consecutivo: 99 }), hasher);
    const ref = generarReferenciaPago(factura, 99, hasher);
    expect(ref.split('-')[2]).toBe('99');
  });

  it('cuarto segmento es checksum 4 chars base36 derivado de SHA-256', () => {
    const factura = emitirFactura(inputBase({ consecutivo: 1 }), hasher);
    const ref = generarReferenciaPago(factura, 1, hasher);
    const checksum = ref.split('-')[3];
    expect(checksum).toMatch(/^[0-9A-Z]{4}$/);
  });

  it('mismo input produce misma referencia (determinista)', () => {
    const a = emitirFactura(inputBase({ consecutivo: 1 }), hasher);
    const b = emitirFactura(inputBase({ consecutivo: 1 }), hasher);
    expect(generarReferenciaPago(a, 1, hasher)).toBe(generarReferenciaPago(b, 1, hasher));
  });

  it('distinto consecutivo → distinta referencia', () => {
    const a = emitirFactura(inputBase({ consecutivo: 1 }), hasher);
    const b = emitirFactura(inputBase({ consecutivo: 2 }), hasher);
    expect(generarReferenciaPago(a, 1, hasher)).not.toBe(generarReferenciaPago(b, 2, hasher));
  });
});

describe('generarQrPago — payload JSON con 4 campos', () => {
  it('el resultado es JSON parseable', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    const qr = generarQrPago(factura);
    expect(() => JSON.parse(qr)).not.toThrow();
  });

  it('contiene exactamente 4 campos canónicos', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    const qr = generarQrPago(factura);
    const parsed = JSON.parse(qr) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      'codigo_verificacion',
      'fecha_emision',
      'referencia_pago',
      'valor_total',
    ]);
  });

  it('codigo_verificacion del QR coincide con el de la factura (10 base36)', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    const qr = generarQrPago(factura);
    const parsed = JSON.parse(qr) as { codigo_verificacion: string };
    expect(parsed.codigo_verificacion).toBe(factura.codigo_verificacion);
    expect(parsed.codigo_verificacion.length).toBe(10);
    expect(esCodigoVerificacionValido(parsed.codigo_verificacion)).toBe(true);
  });

  it('valor_total es numero (en pesos)', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    const qr = generarQrPago(factura);
    const parsed = JSON.parse(qr) as { valor_total: unknown };
    expect(typeof parsed.valor_total).toBe('number');
    expect(parsed.valor_total).toBeGreaterThan(0);
  });

  it('fecha_emision es ISO 8601 (YYYY-MM-DD)', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    const qr = generarQrPago(factura);
    const parsed = JSON.parse(qr) as { fecha_emision: string };
    expect(parsed.fecha_emision).toBe('2026-02-01');
  });

  it('referencia_pago tiene formato {prestador}-{periodo}-{consecutivo}-{checksum}', () => {
    const factura = emitirFactura(inputBase({ consecutivo: 1 }), hasher, idGen);
    const qr = generarQrPago(factura);
    const parsed = JSON.parse(qr) as { referencia_pago: string };
    expect(parsed.referencia_pago).toMatch(/^.+-.+-.+-.{4}$/);
  });

  it('es determinista: misma factura → mismo QR', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    const a = generarQrPago(factura);
    const b = generarQrPago(factura);
    expect(a).toBe(b);
  });
});

describe('emitirFactura — campos top-level: codigo_verificacion, referencia_pago, qr_pago, version_tarifa_aplicada', () => {
  it('emite factura con codigo_verificacion 10 chars base36', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.codigo_verificacion).toHaveLength(10);
    expect(esCodigoVerificacionValido(factura.codigo_verificacion)).toBe(true);
  });

  it('emite factura con version_tarifa_aplicada copiada del motor', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.version_tarifa_aplicada).toBe('v825-2017-1.0');
  });

  it('emite factura con referencia_pago formato {prestador}-{periodo}-{consecutivo}-{checksum}', () => {
    const factura = emitirFactura(inputBase({ consecutivo: 1 }), hasher, idGen);
    expect(factura.referencia_pago).toMatch(/^.+-.+-.+-.{4}$/);
  });

  it('emite factura con qr_pago que es JSON parseable con 4 campos', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    expect(factura.qr_pago).toBeDefined();
    const parsed = JSON.parse(factura.qr_pago!) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      'codigo_verificacion',
      'fecha_emision',
      'referencia_pago',
      'valor_total',
    ]);
  });

  it('el codigo_verificacion es determinista para misma factura', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase(), hasher);
    expect(a.codigo_verificacion).toBe(b.codigo_verificacion);
  });

  it('distinto prestador → distinto codigo_verificacion', () => {
    const prestador2: Prestador = { ...prestadorBase(), nombre: 'OTRO PRESTADOR' };
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase({ prestador: prestador2 }), hasher);
    expect(a.codigo_verificacion).not.toBe(b.codigo_verificacion);
  });

  it('emitirFactura es backward-compatible: sin idGen, NO asigna referencia_pago ni qr_pago', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.referencia_pago).toBeUndefined();
    expect(factura.qr_pago).toBeUndefined();
    // pero codigo_verificacion y version_tarifa_aplicada SI se asignan
    expect(factura.codigo_verificacion).toBeDefined();
    expect(factura.version_tarifa_aplicada).toBeDefined();
  });
});
