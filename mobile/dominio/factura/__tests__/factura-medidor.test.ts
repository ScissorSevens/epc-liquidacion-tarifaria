/**
 * Tests del snapshot del medidor en la factura.
 *
 * Expansion v2: estado, fecha_instalacion, observaciones, id.
 * Tests cubren shape v2, inmutabilidad, determinismo del hash.
 */
'use strict';

import { emitirFactura } from '../factura';
import type { EmitirFacturaInput, FacturaSnapshotMedidor } from '../types';
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
    observaciones: 'Instalado en zona rural',
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

describe('FacturaSnapshotMedidor — expansion v2', () => {
  it('incluye id, numero_medidor, estado, fecha_instalacion', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.medidor).toEqual({
      id_medidor: 10,
      numero_medidor: 'MED-0001',
      estado: 'activo',
      fecha_instalacion: '2024-01-15',
      observaciones: 'Instalado en zona rural',
    });
  });

  it('incluye observaciones cuando se proveen', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.medidor.observaciones).toBe('Instalado en zona rural');
  });

  it('omite observaciones cuando no se proveen', () => {
    const medidorSin: Medidor = {
      id_medidor: 10,
      numero_medidor: 'MED-0001',
      id_suscriptor: 1,
      fecha_instalacion: '2024-01-15',
      estado: 'activo',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const factura = emitirFactura(inputBase({ medidor: medidorSin }), hasher);
    expect(factura.snapshot.medidor.observaciones).toBeUndefined();
  });

  it('snapshot.medidor esta deepFrozen', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(Object.isFrozen(factura.snapshot.medidor)).toBe(true);
    expect(() => {
      (factura.snapshot.medidor as { estado: string }).estado = 'X';
    }).toThrow(TypeError);
  });

  it('cambiar el numero_medidor cambia el hash (estado sigue activo)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ medidor: { ...medidorBase(), numero_medidor: 'MED-9999' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar la fecha_instalacion del medidor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ medidor: { ...medidorBase(), fecha_instalacion: '2025-06-01' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el id_medidor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ medidor: { ...medidorBase(), id_medidor: 99 } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('mismo medidor produce mismo hash (determinismo)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase(), hasher);
    expect(a.hash).toBe(b.hash);
  });

  it('FacturaSnapshotMedidor expone 4 campos requeridos + observaciones opcional', () => {
    const snap: FacturaSnapshotMedidor = {
      id_medidor: 1,
      numero_medidor: 'X',
      estado: 'activo',
      fecha_instalacion: '2024-01-01',
    };
    expect(Object.keys(snap).sort()).toEqual([
      'estado',
      'fecha_instalacion',
      'id_medidor',
      'numero_medidor',
    ]);
  });
});
