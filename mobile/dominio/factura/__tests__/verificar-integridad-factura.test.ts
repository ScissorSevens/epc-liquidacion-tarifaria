/**
 * Tests del helper `verificarIntegridadFactura` con compatibilidad v1+v2.
 *
 * Cubre:
 *  - Factura v2 (emitida por `emitirFactura`) verifica `true`.
 *  - Factura v1 (legacy, sin prestador) verifica `true` con su firma v1.
 *  - Mutacion de cualquier campo del snapshot v2 invalida la firma.
 *  - Mutacion del hash directamente invalida la firma.
 */
'use strict';

import {
  emitirFactura,
  verificarIntegridadFactura,
  calcularHashFactura,
} from '../factura';
import type {
  EmitirFacturaInput,
  Factura,
  FacturaSnapshot,
} from '../types';
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

/**
 * Construye una Factura v1 "legacy" con snapshot reducido (sin
 * prestador, sin metadata, sin otros_valores). El hash se calcula con
 * el algoritmo v1 (payload reducido) para que la verificación pase.
 */
function facturaV1Legacy(): Factura {
  const facturaV2 = emitirFactura(inputBase(), hasher);
  // Construimos snapshot v1: descartamos prestador/otros_valores/saldo_anterior/metadata
  const snapshotV1 = {
    suscriptor: facturaV2.snapshot.suscriptor,
    medidor: facturaV2.snapshot.medidor,
    periodo: facturaV2.snapshot.periodo,
    operario: facturaV2.snapshot.operario,
    lectura: facturaV2.snapshot.lectura,
    liquidacion: facturaV2.snapshot.liquidacion,
    consumosHistoricos: facturaV2.snapshot.consumosHistoricos,
  };
  // Forzamos hash v1 (algoritmo reducido) + metadata.hash_version='v1'
  const payloadV1 = JSON.stringify({
    numero_factura: facturaV2.numero_factura,
    fecha_emision: facturaV2.fecha_emision,
    snapshot: snapshotV1,
  });
  const hashV1 = hasher.sha256(payloadV1);
  const snapshotConVersionV1: FacturaSnapshot = {
    ...facturaV2.snapshot,
    metadata: { hash_version: 'v1' },
  };
  return {
    ...facturaV2,
    hash: hashV1,
    snapshot: snapshotConVersionV1,
  };
}

describe('verificarIntegridadFactura — v2 (happy path)', () => {
  it('factura v2 recien emitida verifica true', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(verificarIntegridadFactura(factura, hasher)).toBe(true);
  });

  it('mutacion del hash directamente invalida la firma', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const facturaAlterada: Factura = { ...factura, hash: 'hash-fake-99999999' };
    expect(verificarIntegridadFactura(facturaAlterada, hasher)).toBe(false);
  });

  it('mutacion de la cedula del suscriptor invalida la firma', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const facturaAlterada: Factura = {
      ...factura,
      snapshot: {
        ...factura.snapshot,
        suscriptor: { ...factura.snapshot.suscriptor, cedula: '999999999' },
      },
    };
    expect(verificarIntegridadFactura(facturaAlterada, hasher)).toBe(false);
  });

  it('mutacion del total liquidacion invalida la firma', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const facturaAlterada: Factura = {
      ...factura,
      snapshot: {
        ...factura.snapshot,
        liquidacion: {
          ...factura.snapshot.liquidacion,
          resultado: {
            ...factura.snapshot.liquidacion.resultado,
            total: 99999,
          },
        },
      },
    };
    expect(verificarIntegridadFactura(facturaAlterada, hasher)).toBe(false);
  });

  it('coincide con el hash recalculado manualmente (sanity check)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const esperado = calcularHashFactura(
      factura.snapshot,
      factura.numero_factura,
      factura.fecha_emision,
      hasher,
    );
    expect(factura.hash).toBe(esperado);
    expect(verificarIntegridadFactura(factura, hasher)).toBe(true);
  });
});

describe('verificarIntegridadFactura — v1 (compatibilidad retroactiva)', () => {
  it('factura v1 legacy (snapshot reducido) verifica true con su firma v1', () => {
    const facturaV1 = facturaV1Legacy();
    expect(facturaV1.snapshot.metadata.hash_version).toBe('v1');
    expect(verificarIntegridadFactura(facturaV1, hasher)).toBe(true);
  });

  it('factura v1 con mutacion de la firma invalida la verificacion', () => {
    const facturaV1 = facturaV1Legacy();
    const facturaAlterada: Factura = { ...facturaV1, hash: 'hash-fake-aaaaaaaa' };
    expect(verificarIntegridadFactura(facturaAlterada, hasher)).toBe(false);
  });

  it('el algoritmo v2 NO verifica una factura v1 (compatibilidad hacia atras)', () => {
    const facturaV1 = facturaV1Legacy();
    // Si calcularamos con algoritmo v2 (el de hoy), NO coincide con el
    // hash v1 — prueba que el helper detecta correctamente la version.
    const esperadoV2 = calcularHashFactura(
      facturaV1.snapshot,
      facturaV1.numero_factura,
      facturaV1.fecha_emision,
      hasher,
    );
    expect(facturaV1.hash).not.toBe(esperadoV2);
    // Pero verificarIntegridadFactura SI retorna true porque detecta v1
    expect(verificarIntegridadFactura(facturaV1, hasher)).toBe(true);
  });
});
