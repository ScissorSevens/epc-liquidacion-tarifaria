/**
 * Tests especificos del round-trip de las 4 columnas de migration 020.
 *
 * Cubre:
 *  - codigo_verificacion: INSERT y SELECT preservan el valor.
 *  - referencia_pago: INSERT y SELECT preservan el valor.
 *  - qr_pago: INSERT y SELECT preservan el valor.
 *  - version_tarifa_aplicada: INSERT y SELECT preservan el valor.
 *  - Factura con todos los campos: round-trip idempotente.
 *
 * Migration 020 agrega 4 columnas a la tabla `factura`. Si el adapter
 * NO cablea esas columnas al INSERT/SELECT, las filas se pierden al
 * round-trip (regresion CRITICAL 10).
 */
'use strict';

import {
  emitirFactura,
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
import { crearDBTest } from '../../persistencia/sqlite/__fixtures__/crear-db-test';
import { crearFacturaRepositorySqlite } from '../factura-repository-sqlite';

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

describe('factura-repository-sqlite — migration 020 round-trip de 4 columnas', () => {
  let db: ReturnType<typeof crearDBTest>;
  let repo: ReturnType<typeof crearFacturaRepositorySqlite>;

  beforeEach(() => {
    db = crearDBTest();
    repo = crearFacturaRepositorySqlite(db);
  });
  afterEach(() => {
    repo.cerrar();
  });

  it('INSERT + SELECT preserva codigo_verificacion', async () => {
    const facturaInput = emitirFactura(inputBase(), hasher, idGen);
    const creada = await repo.crear(facturaInput);
    expect(creada.codigo_verificacion).toBe(facturaInput.codigo_verificacion);
    expect(creada.codigo_verificacion.length).toBe(10);
  });

  it('INSERT + SELECT preserva referencia_pago', async () => {
    const facturaInput = emitirFactura(inputBase({ consecutivo: 7 }), hasher, idGen);
    const creada = await repo.crear(facturaInput);
    expect(creada.referencia_pago).toBe(facturaInput.referencia_pago);
    expect(creada.referencia_pago).toMatch(/^.+-.+-.+-.{4}$/);
  });

  it('INSERT + SELECT preserva qr_pago', async () => {
    const facturaInput = emitirFactura(inputBase(), hasher, idGen);
    const creada = await repo.crear(facturaInput);
    expect(creada.qr_pago).toBe(facturaInput.qr_pago);
    expect(creada.qr_pago).toBeDefined();
    const parsed = JSON.parse(creada.qr_pago!) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      'codigo_verificacion',
      'fecha_emision',
      'referencia_pago',
      'valor_total',
    ]);
  });

  it('INSERT + SELECT preserva version_tarifa_aplicada', async () => {
    const resultadoConVersion: ResultadoCalculo = {
      ...resultadoBase(),
      metadata: { ...resultadoBase().metadata, version_motor: 'v825-2017-1.0' },
    };
    const liqBase = {
      id: '22222222-2222-2222-2222-222222222222',
      suscriptorId: '1',
      fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
      resultado: resultadoConVersion,
      estado: 'ACTIVA' as const,
    };
    const liquidacion: Liquidacion = { ...liqBase, hash: calcularHash(liqBase, hasher) };
    const facturaInput = emitirFactura(inputBase({ liquidacion }), hasher, idGen);
    const creada = await repo.crear(facturaInput);
    expect(creada.version_tarifa_aplicada).toBe('v825-2017-1.0');
  });

  it('round-trip completo: los 4 campos se preservan en INSERT + SELECT', async () => {
    const facturaInput = emitirFactura(inputBase({ consecutivo: 99 }), hasher, idGen);
    const creada = await repo.crear(facturaInput);
    expect(creada.codigo_verificacion).toBe(facturaInput.codigo_verificacion);
    expect(creada.referencia_pago).toBe(facturaInput.referencia_pago);
    expect(creada.qr_pago).toBe(facturaInput.qr_pago);
    expect(creada.version_tarifa_aplicada).toBe(facturaInput.version_tarifa_aplicada);
  });

  it('buscarPorId recupera los 4 campos despues de persistir', async () => {
    const facturaInput = emitirFactura(inputBase({ consecutivo: 42 }), hasher, idGen);
    const creada = await repo.crear(facturaInput);
    const recuperada = (await repo.buscarPorId(creada.id)) as Factura;
    expect(recuperada).not.toBeNull();
    expect(recuperada.codigo_verificacion).toBe(creada.codigo_verificacion);
    expect(recuperada.referencia_pago).toBe(creada.referencia_pago);
    expect(recuperada.qr_pago).toBe(creada.qr_pago);
    expect(recuperada.version_tarifa_aplicada).toBe(creada.version_tarifa_aplicada);
  });
});
