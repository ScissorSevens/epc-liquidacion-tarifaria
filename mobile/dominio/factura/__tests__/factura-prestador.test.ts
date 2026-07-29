/**
 * Tests del snapshot del prestador en la factura.
 *
 * Cubre:
 *  - Activacion de FacturaSnapshotPrestador en el FacturaSnapshot (id,
 *    codigo, nombre, nit, municipio, departamento, representante_legal).
 *  - Helper puro `extraerSnapshotPrestador(prestador)`.
 *  - Reproducibilidad del hash con payload v2 (incluye prestador).
 *  - Tests de integracion: buildSnapshot preserva solo los campos
 *    publiqueables (Q3 auditabilidad), nunca password_hash ni tokens.
 *  - Tests de edge cases: prestador legacy (id_prestador=0), cambios
 *    en cualquier campo del prestador cambian el hash.
 *
 * TDD: tests escritos PRIMERO. Factura.ts NO incluye prestador en
 * snapshot todavia → todos estos tests fallan en RED.
 */
'use strict';

import { extraerSnapshotPrestador, emitirFactura, calcularHashFactura } from '../factura';
import { MENSAJES_ERROR_FACTURA, type EmitirFacturaInput, type FacturaSnapshotPrestador } from '../types';
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

describe('extraerSnapshotPrestador — helper puro', () => {
  it('proyecta Prestador → FacturaSnapshotPrestador con 7 campos', () => {
    const prestador = prestadorBase();
    const snap = extraerSnapshotPrestador(prestador);
    expect(snap).toEqual({
      id_prestador: 1,
      codigo: '0001',
      nombre: 'Aguas del Valle S.A. E.S.P.',
      nit: '900123456-7',
      municipio: 'Cali',
      departamento: 'Valle del Cauca',
      representante_legal: 'Carlos Ramírez',
    });
  });

  it('NO incluye representante_legal_cedula (no aparece en Res CRA 1038 §1)', () => {
    const snap = extraerSnapshotPrestador(prestadorBase());
    expect(snap).not.toHaveProperty('representante_legal_cedula');
  });

  it('NO incluye contacto, segmento, num_suscriptores, estado, timestamps', () => {
    const snap = extraerSnapshotPrestador(prestadorBase());
    const keys = Object.keys(snap).sort();
    expect(keys).toEqual([
      'codigo',
      'departamento',
      'id_prestador',
      'municipio',
      'nit',
      'nombre',
      'representante_legal',
    ]);
  });

  it('retorna objeto deepFrozen (mutacion lanza en strict)', () => {
    const snap = extraerSnapshotPrestador(prestadorBase());
    expect(Object.isFrozen(snap)).toBe(true);
    expect(() => {
      (snap as { nit: string }).nit = 'X';
    }).toThrow(TypeError);
  });

  it('proyecta correctamente el prestador legacy (id_prestador=0)', () => {
    const legacy: Prestador = { ...prestadorBase(), id_prestador: 0, codigo: 'EPC-LEGACY' };
    const snap = extraerSnapshotPrestador(legacy);
    expect(snap.id_prestador).toBe(0);
    expect(snap.codigo).toBe('EPC-LEGACY');
  });
});

describe('emitirFactura — snapshot.prestador presente', () => {
  it('incluye snapshot.prestador con todos los campos del catalogo', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.prestador).toEqual({
      id_prestador: 1,
      codigo: '0001',
      nombre: 'Aguas del Valle S.A. E.S.P.',
      nit: '900123456-7',
      municipio: 'Cali',
      departamento: 'Valle del Cauca',
      representante_legal: 'Carlos Ramírez',
    });
  });

  it('snapshot.prestador esta deepFrozen', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(Object.isFrozen(factura.snapshot.prestador)).toBe(true);
    expect(() => {
      (factura.snapshot.prestador as { nit: string }).nit = 'X';
    }).toThrow(TypeError);
  });

  it('cambiar el prestador en el input cambia el snapshot.prestador', () => {
    const prestador2: Prestador = { ...prestadorBase(), nombre: 'OTRO PRESTADOR', nit: '111111111-1' };
    const factura = emitirFactura(inputBase({ prestador: prestador2 }), hasher);
    expect(factura.snapshot.prestador.nombre).toBe('OTRO PRESTADOR');
    expect(factura.snapshot.prestador.nit).toBe('111111111-1');
  });

  it('declina emitirFactura si falta input.prestador (TS: required field)', () => {
    // Garantia a nivel tipo: si EmitirFacturaInput exige prestador, este
    // test verifica que el consumidor debe hidratarlo. El compilador
    // seria la 1ra linea de defensa; el test documenta el contrato.
    const inputSinPrestador = inputBase();
    // Forzamos el shape required quitando prestador via cast para
    // emular el caso de un caller desactualizado.
    const inputRoto = { ...inputSinPrestador, prestador: undefined as unknown as Prestador };
    expect(() => emitirFactura(inputRoto, hasher)).toThrow(
      /prestador/i,
    );
  });
});

describe('emitirFactura — hash v2 con prestador', () => {
  it('hash incluye prestador en el payload canonico (cambia si cambia prestador)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const prestador2: Prestador = { ...prestadorBase(), nit: '999999999-9' };
    const b = emitirFactura(inputBase({ prestador: prestador2 }), hasher);
    expect(a.hash).not.toBe(b.hash);
  });

  it('mismo input produce mismo hash (determinismo)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase(), hasher);
    expect(a.hash).toBe(b.hash);
  });

  it('calcularHashFactura(factura) con snapshot v2 refleja hash_version v2 en payload', () => {
    // El calculo del hash es interno. Verificamos que las firmas
    // estructurales siguen: si le pasamos un snapshot CON prestador,
    // el hash calculado coincide con el hash de la factura.
    const factura = emitirFactura(inputBase(), hasher);
    const calc = calcularHashFactura(
      factura.snapshot,
      factura.numero_factura,
      factura.fecha_emision,
      hasher,
    );
    expect(calc).toBe(factura.hash);
  });
});

describe('FacturaSnapshotPrestador — type constraints', () => {
  it('shape inmutable: 7 campos readonly', () => {
    const snap: FacturaSnapshotPrestador = {
      id_prestador: 1,
      codigo: 'X',
      nombre: 'X',
      nit: 'X',
      municipio: 'X',
      departamento: 'X',
      representante_legal: 'X',
    };
    // Type-only test: si el shape del type cambiara, este cast rompera.
    const _check: Readonly<FacturaSnapshotPrestador> = snap;
    expect(_check).toBe(snap);
  });
});
