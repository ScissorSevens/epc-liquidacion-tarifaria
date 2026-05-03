/**
 * Tests del módulo FACTURA — funciones puras.
 *
 * Tests importan `MENSAJES_ERROR_FACTURA.CLAVE` — nunca literales.
 * Inputs construidos inline por test desde una base mínima válida.
 */

import { emitirFactura } from '../factura';
import type { EmitirFacturaInput } from '../types';
import type { Liquidacion } from '../../calculo/types';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { ResultadoCalculo } from '../../motor-tarifario';

// Helpers locales: construyen aggregates mínimos válidos para tests.
// NO son shared builders: cada test compone su input adaptándolos inline.
function suscriptorBase(): Suscriptor {
  return {
    id_suscriptor: 1,
    codigo: '00001',
    nombre_apellidos: 'María López',
    direccion: 'Calle 5 #2-10',
    estrato: 2,
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
    consumo: 12,
    consumoBasico: 12,
    consumoExcedente: 0,
    cargoFijo: 5000,
    cargoConsumo: 18000,
    cargoExcedente: 0,
    subsidio: 4600,
    contribucion: 0,
    total: 18400,
  };
}

function liquidacionBase(): Liquidacion {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
    resultado: resultadoCalculoBase(),
    estado: 'ACTIVA',
    hash: 'hash-fake-no-validado-en-phase-2',
  };
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

describe('emitirFactura — happy path', () => {
  it('devuelve Factura con estado BORRADOR', () => {
    const factura = emitirFactura(inputBase());
    expect(factura.estado).toBe('BORRADOR');
  });

  it('formatea numero_factura como {dispositivo_id}-{consecutivo} con padding', () => {
    const input = inputBase();
    const operario = { ...operarioBase(), dispositivo_id: 'MZ-001' };
    const factura = emitirFactura({ ...input, operario, consecutivo: 2981 });
    expect(factura.numero_factura).toBe('MZ-001-2981');
  });

  it('snapshotea suscriptor (codigo, nombre, direccion, estrato) y lo congela', () => {
    const suscriptor: Suscriptor = {
      ...suscriptorBase(),
      codigo: '00042',
      nombre_apellidos: 'Carlos Ruiz',
      direccion: 'Carrera 7 #14-30',
      estrato: 3,
    };
    const factura = emitirFactura({ ...inputBase(), suscriptor });
    expect(factura.snapshot.suscriptor).toEqual({
      codigo: '00042',
      nombre_apellidos: 'Carlos Ruiz',
      direccion: 'Carrera 7 #14-30',
      estrato: 3,
    });
    expect(Object.isFrozen(factura.snapshot.suscriptor)).toBe(true);
  });
});
