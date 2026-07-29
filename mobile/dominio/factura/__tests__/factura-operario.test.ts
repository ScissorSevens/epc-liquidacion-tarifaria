/**
 * Tests del snapshot del operario en la factura.
 *
 * Expansion v2: cedula, email, rol, estado, id_prestador.
 * CRITICO: password_hash NUNCA aparece en el snapshot.
 */
'use strict';

import { emitirFactura } from '../factura';
import type { EmitirFacturaInput, FacturaSnapshotOperario } from '../types';
import { calcularHash } from '../../calculo/calculo';
import type { Liquidacion } from '../../calculo/types';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { Prestador } from '../../prestadores/types';
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
    password_hash: 'argon2id$v=19$m=65536,t=3,p=4$SALT$HASH',
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

function inputBase(overrides: Partial<EmitirFacturaInput> = {}): EmitirFacturaInput {
  return {
    suscriptor: suscriptorBase(),
    medidor: medidorBase(),
    periodo: periodoBase(),
    operario: operarioBase(),
    prestador: prestadorBase(),
    liquidacion: liquidacionBase(),
    consumosHistoricos: [],
    fechaEmision: '2026-02-01',
    consecutivo: 1,
    ...overrides,
  };
}

describe('FacturaSnapshotOperario — expansion v2', () => {
  it('incluye id, nombre, cedula, email, rol, estado, id_prestador, dispositivo_id', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.operario).toEqual({
      id_operario: 7,
      id_prestador: 1,
      numero_cedula: '1234567890',
      nombre: 'Ana Gómez',
      email: 'ana@epc.co',
      rol: 'operario',
      estado: 'activo',
      dispositivo_id: 'MZ-001',
    });
  });

  it('NUNCA contiene password_hash (security)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.operario).not.toHaveProperty('password_hash');
    const serialized = JSON.stringify(factura.snapshot.operario);
    expect(serialized).not.toMatch(/argon2id|SALT|HASH|password/i);
  });

  it('snapshot.operario esta deepFrozen', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(Object.isFrozen(factura.snapshot.operario)).toBe(true);
    expect(() => {
      (factura.snapshot.operario as { rol: string }).rol = 'X';
    }).toThrow(TypeError);
  });

  it('cambiar la cedula del operario cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ operario: { ...operarioBase(), numero_cedula: '9999999999' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el rol del operario cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ operario: { ...operarioBase(), rol: 'supervisor' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el email del operario cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ operario: { ...operarioBase(), email: 'otro@epc.co' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el id_prestador del operario cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ operario: { ...operarioBase(), id_prestador: 2 } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el password_hash NO cambia el hash (security: hash excluye password)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({
        operario: { ...operarioBase(), password_hash: 'otro-hash-1234' },
      }),
      hasher,
    );
    expect(a.hash).toBe(b.hash);
  });

  it('mismo operario produce mismo hash (determinismo)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase(), hasher);
    expect(a.hash).toBe(b.hash);
  });

  it('FacturaSnapshotOperario expone 8 campos (shape v2)', () => {
    const snap: FacturaSnapshotOperario = {
      id_operario: 1,
      id_prestador: 1,
      numero_cedula: 'X',
      nombre: 'X',
      email: 'X',
      rol: 'operario',
      estado: 'activo',
      dispositivo_id: 'X',
    };
    expect(Object.keys(snap).sort()).toEqual([
      'dispositivo_id',
      'email',
      'estado',
      'id_operario',
      'id_prestador',
      'nombre',
      'numero_cedula',
      'rol',
    ]);
  });
});
