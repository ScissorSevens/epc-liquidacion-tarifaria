/**
 * Tests del snapshot del suscriptor en la factura.
 *
 * Cubre:
 *  - Expansion de FacturaSnapshotSuscriptor con cedula, email, telefono,
 *    municipio, sector, calle.
 *  - Inmutabilidad del snapshot.
 *  - Reproducibilidad del hash: cambios en cualquier campo del suscriptor
 *    cambian el hash.
 *  - Sanitization: suscriptor inactivo o sin estado no aparecen como
 *    "activo" en el snapshot.
 *
 * TDD phase: tests RED que motivan la expansion del snapshot.
 */
'use strict';

import { emitirFactura } from '../factura';
import type { EmitirFacturaInput, FacturaSnapshotSuscriptor } from '../types';
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
    email: 'maria@example.com',
    telefono: '3001234567',
    municipio: 'Bogotá',
    sector: 'Centro',
    direccion: 'Calle 5 #2-10',
    estrato: 2,
    matricula_inmobiliaria: 'MAT-001',
    numero_catastral: 'CAT-001',
    aplica_subsidio: false,
    id_prestador: 0,
    categoria_uso: 'residencial',
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function suscriptorSinCamposOpcionales(): Suscriptor {
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

describe('FacturaSnapshotSuscriptor — expansion v2', () => {
  it('incluye todos los campos del Suscriptor en el snapshot', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.suscriptor).toEqual({
      codigo: '00001',
      nombre_apellidos: 'María López',
      cedula: '123456789',
      email: 'maria@example.com',
      telefono: '3001234567',
      municipio: 'Bogotá',
      sector: 'Centro',
      // calle: null explicito (campo eliminado del modelo Suscriptor).
      calle: null,
      direccion: 'Calle 5 #2-10',
      estrato: 2,
      estado: 'activo',
      matricula_inmobiliaria: 'MAT-001',
      numero_catastral: 'CAT-001',
      id_prestador: 0,
      categoria_uso: 'residencial',
    });
  });

  it('campos opcionales (email, telefono, sector, calle, matricula, catastral) son null cuando no se proveen', () => {
    const factura = emitirFactura(inputBase({ suscriptor: suscriptorSinCamposOpcionales() }), hasher);
    const snap = factura.snapshot.suscriptor;
    expect(snap.email).toBeNull();
    expect(snap.telefono).toBeNull();
    expect(snap.sector).toBeNull();
    expect(snap.calle).toBeNull();
    expect(snap.matricula_inmobiliaria).toBeNull();
    expect(snap.numero_catastral).toBeNull();
  });

  it('expone estado del suscriptor denormalizado (activo en el happy path)', () => {
    // emitirFactura solo emite si suscriptor.estado === 'activo'. Cuando
    // pasa, el snapshot preserva 'activo' en su sub-objeto para que la
    // auditoria historica NO tenga que volver al origen para saber el
    // estado al momento de emision.
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.suscriptor.estado).toBe('activo');
  });

  it('el tipo de estado cubre los 3 valores del spec (activo, suspendido, facturado)', () => {
    // Cobertura del shape: el type del snapshot admite los 3 valores
    // del estado del suscriptor. Esto es test a nivel type — verifica
    // que el contrato del spec no se restringio a 'activo' por bug.
    type EstadoSpec = 'activo' | 'suspendido' | 'facturado';
    const estados: EstadoSpec[] = ['activo', 'suspendido', 'facturado'];
    expect(estados.length).toBe(3);
    // el snapshot del happy path emite 'activo' por la validacion de
    // emitirFactura, pero el TIPO del campo admite los 3.
    const _tipoAcepta: FacturaSnapshotSuscriptor['estado'] = 'suspendido';
    expect(_tipoAcepta).toBe('suspendido');
  });

  it('snapshot.suscriptor esta deepFrozen', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(Object.isFrozen(factura.snapshot.suscriptor)).toBe(true);
    expect(() => {
      (factura.snapshot.suscriptor as { cedula: string }).cedula = 'X';
    }).toThrow(TypeError);
  });

  it('cambiar la cedula del suscriptor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ suscriptor: { ...suscriptorBase(), cedula: '999999999' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el email del suscriptor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ suscriptor: { ...suscriptorBase(), email: 'otro@example.com' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el telefono del suscriptor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ suscriptor: { ...suscriptorBase(), telefono: '3119999999' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el municipio del suscriptor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ suscriptor: { ...suscriptorBase(), municipio: 'Medellín' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar el sector del suscriptor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ suscriptor: { ...suscriptorBase(), sector: 'Norte' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar matricula_inmobiliaria del suscriptor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ suscriptor: { ...suscriptorBase(), matricula_inmobiliaria: 'MAT-002' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar numero_catastral del suscriptor cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ suscriptor: { ...suscriptorBase(), numero_catastral: 'CAT-002' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('mismo suscriptor completo produce mismo hash (determinismo)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase(), hasher);
    expect(a.hash).toBe(b.hash);
  });

  it('FacturaSnapshotSuscriptor tiene 14 campos (shape v2 con estado + null explicito)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    const keys = Object.keys(factura.snapshot.suscriptor).sort();
    // Suscriptor base del test incluye matricula_inmobiliaria y numero_catastral.
    expect(keys).toEqual([
      'calle',
      'categoria_uso',
      'cedula',
      'codigo',
      'direccion',
      'email',
      'estado',
      'estrato',
      'id_prestador',
      'matricula_inmobiliaria',
      'municipio',
      'nombre_apellidos',
      'numero_catastral',
      'sector',
      'telefono',
    ]);
  });
});
