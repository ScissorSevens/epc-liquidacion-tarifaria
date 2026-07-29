/**
 * Tests del snapshot de la lectura en la factura.
 *
 * Expansion v2: lectura_actual, lectura_anterior, foto (path + hash),
 * timestamp_captura, observaciones.
 *
 * TDD: tests RED que motivan la inclusion de la lectura completa en el
 * snapshot. Res CRA 1038/2026 §3 exige publicar la lectura que origina
 * la facturacion.
 */
'use strict';

import { emitirFactura } from '../factura';
import type { EmitirFacturaInput, FacturaSnapshotLectura } from '../types';
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
    evidencia: {
      foto_path: 'file:///photo.jpg',
      foto_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    },
    estado_validacion: 'validado',
    observaciones: 'Sin novedad',
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

describe('FacturaSnapshotLectura — expansion v2', () => {
  it('incluye las 7 claves planas: lectura_actual, lectura_anterior, estado_validacion, evidencia_foto_path, evidencia_foto_hash, timestamp_captura, observaciones', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.lectura).toEqual({
      lectura_actual: 1234,
      lectura_anterior: 1200,
      estado_validacion: 'validado',
      evidencia_foto_path: 'file:///photo.jpg',
      evidencia_foto_hash:
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      timestamp_captura: '2026-02-01T08:30:00.000Z',
      observaciones: 'Sin novedad',
    });
  });

  it('NO usa objeto evidencia anidado (snapshot aplanado)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.lectura).not.toHaveProperty('evidencia');
  });

  it('claves evidencia_* son null cuando no hay foto', () => {
    const lecturaSinFoto: Lectura = {
      id_medidor: 10,
      id_periodo: '202601',
      id_operario: 7,
      lectura_actual: 1234,
      lectura_anterior: 1200,
      estado_validacion: 'pendiente',
      timestamp_captura: '2026-02-01T08:30:00.000Z',
      estado_sync: 'pendiente',
    };
    const factura = emitirFactura(inputBase({ lectura: lecturaSinFoto }), hasher);
    expect(factura.snapshot.lectura.evidencia_foto_path).toBeNull();
    expect(factura.snapshot.lectura.evidencia_foto_hash).toBeNull();
  });

  it('observaciones es null cuando no se provee', () => {
    const lecturaSinObs: Lectura = {
      ...lecturaBase(),
      observaciones: undefined,
    };
    const factura = emitirFactura(inputBase({ lectura: lecturaSinObs }), hasher);
    expect(factura.snapshot.lectura.observaciones).toBeNull();
  });

  it('estado_validacion preserva valor origen (pendiente | validado | error)', () => {
    const estados: Array<'pendiente' | 'validado' | 'error'> = [
      'pendiente',
      'validado',
      'error',
    ];
    for (const estado of estados) {
      const factura = emitirFactura(
        inputBase({ lectura: { ...lecturaBase(), estado_validacion: estado } }),
        hasher,
      );
      expect(factura.snapshot.lectura.estado_validacion).toBe(estado);
    }
  });

  it('snapshot.lectura esta deepFrozen', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(Object.isFrozen(factura.snapshot.lectura)).toBe(true);
    expect(() => {
      (factura.snapshot.lectura as { lectura_actual: number }).lectura_actual = 9999;
    }).toThrow(TypeError);
  });

  it('cambiar lectura_actual cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ lectura: { ...lecturaBase(), lectura_actual: 1300 } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar lectura_anterior cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ lectura: { ...lecturaBase(), lectura_anterior: 1100 } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar timestamp_captura cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ lectura: { ...lecturaBase(), timestamp_captura: '2026-02-02T08:30:00.000Z' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar estado_validacion cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ lectura: { ...lecturaBase(), estado_validacion: 'error' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar foto_path de la evidencia cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({
        lectura: {
          ...lecturaBase(),
          evidencia: { foto_path: 'file:///otra.jpg', foto_hash: 'h' },
        },
      }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar foto_hash de la evidencia cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({
        lectura: {
          ...lecturaBase(),
          evidencia: { foto_path: 'file:///photo.jpg', foto_hash: 'otro-hash' },
        },
      }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('cambiar observaciones cambia el hash', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(
      inputBase({ lectura: { ...lecturaBase(), observaciones: 'Con novedad' } }),
      hasher,
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it('misma lectura produce mismo hash (determinismo)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const b = emitirFactura(inputBase(), hasher);
    expect(a.hash).toBe(b.hash);
  });

  it('emisión requiere input.lectura (TS: required field)', () => {
    const inputSinLectura = inputBase();
    const inputRoto = { ...inputSinLectura, lectura: undefined as unknown as Lectura };
    expect(() => emitirFactura(inputRoto, hasher)).toThrow(/lectura/i);
  });

  it('FacturaSnapshotLectura shape v2 — exactamente 7 claves planas', () => {
    const snap: FacturaSnapshotLectura = {
      lectura_actual: 1,
      lectura_anterior: 0,
      estado_validacion: 'validado',
      evidencia_foto_path: 'x',
      evidencia_foto_hash: 'y',
      timestamp_captura: 'X',
      observaciones: 'z',
    };
    expect(Object.keys(snap).sort()).toEqual([
      'estado_validacion',
      'evidencia_foto_hash',
      'evidencia_foto_path',
      'lectura_actual',
      'lectura_anterior',
      'observaciones',
      'timestamp_captura',
    ]);
  });
});
