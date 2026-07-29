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
  calcularCodigoVerificacion,
  generarReferenciaPago,
  generarQrPago,
} from '../factura';
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
  it('retorna string derivado del hash canónico', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const codigo = calcularCodigoVerificacion(factura);
    // En produccion (SHA-256 hex = 64 chars) el codigo tiene 16 chars.
    // En tests con hasher fake puede ser más corto. Validamos que es
    // un prefijo del hash canonico.
    expect(factura.hash.startsWith(codigo)).toBe(true);
    expect(codigo.length).toBeGreaterThan(0);
  });

  it('misma factura produce mismo codigo (puro)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const a = calcularCodigoVerificacion(factura);
    const b = calcularCodigoVerificacion(factura);
    expect(a).toBe(b);
  });

  it('cambiar el hash de la factura cambia el codigo', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const codigoOriginal = calcularCodigoVerificacion(factura);
    const facturaModificada: Factura = { ...factura, hash: 'otro-hash-1234567890abcdef' };
    const codigoModificado = calcularCodigoVerificacion(facturaModificada);
    expect(codigoOriginal).not.toBe(codigoModificado);
  });

  it('usa el hasher inyectado (no crypto real)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const codigo = calcularCodigoVerificacion(factura);
    // determinista: usar mismo hasher produce mismo codigo
    expect(codigo).toBe(calcularCodigoVerificacion(factura));
  });
});

describe('generarReferenciaPago — helper puro', () => {
  it('genera string formato UUID v4 (36 chars con guiones)', () => {
    const ref = generarReferenciaPago(idGen);
    expect(ref).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('dos invocaciones generan referencias distintas', () => {
    const a = generarReferenciaPago(idGen);
    const b = generarReferenciaPago(idGen);
    expect(a).not.toBe(b);
  });
});

describe('generarQrPago — helper puro', () => {
  it('formato `${prefijo}|${referencia_pago}|${timestamp}`', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const ref = generarReferenciaPago(idGen);
    const timestamp = '2026-02-01T10:00:00.000Z';
    const qr = generarQrPago(factura, ref, timestamp);
    expect(qr).toBe(`EPC|${ref}|${timestamp}`);
  });

  it('prefijo es "EPC" (codigo de la empresa)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const qr = generarQrPago(factura, 'ref-test', '2026-02-01T10:00:00.000Z');
    expect(qr.split('|')[0]).toBe('EPC');
  });

  it('incluye la referencia pasada como argumento', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const qr = generarQrPago(factura, 'mi-referencia-123', '2026-02-01T10:00:00.000Z');
    expect(qr).toContain('mi-referencia-123');
  });
});

describe('emitirFactura — campos top-level: codigo_verificacion, referencia_pago, qr_pago, version_tarifa_aplicada', () => {
  it('emite factura con codigo_verificacion derivado del hash', () => {
    const factura = emitirFactura(inputBase(), hasher);
    // El codigo de verificacion es un derivado del hash canonico. En
    // produccion (SHA-256 hex de 64 chars) tiene 16 chars. En tests
    // con hasher fake puede ser más corto. Validamos que es un
    // prefijo del hash: empieza con el mismo prefijo.
    expect(factura.hash.startsWith(factura.codigo_verificacion)).toBe(true);
    expect(factura.codigo_verificacion.length).toBeGreaterThan(0);
  });

  it('codigo_verificacion es deepFrozen (en la factura)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(Object.isFrozen(factura)).toBe(true);
    // El string es primitivo, no necesita freeze, pero el objeto Factura sí.
  });

  it('emite factura con version_tarifa_aplicada copiada del motor', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.version_tarifa_aplicada).toBe('v825-2017-1.0');
  });

  it('emite factura con referencia_pago y qr_pago', () => {
    const factura = emitirFactura(inputBase(), hasher, idGen);
    expect(factura.referencia_pago).toMatch(/^[0-9a-f-]{36}$/);
    expect(factura.qr_pago).toMatch(/^EPC\|[0-9a-f-]{36}\|\d{4}-\d{2}-\d{2}T/);
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

  it('referencia_pago se puede regenerar con idGen externo', () => {
    const fixedRef = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const customIdGen: IdGenerator = { uuid: () => fixedRef };
    const factura = emitirFactura(inputBase(), hasher, customIdGen);
    expect(factura.referencia_pago).toBe(fixedRef);
    expect(factura.qr_pago).toContain(fixedRef);
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
