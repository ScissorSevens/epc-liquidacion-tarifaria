/**
 * Tests de orquestadores con repo: emitirFacturaConRepo, anularFacturaConRepo,
 * corregirFacturaConRepo. Combinan funciones puras de factura.ts con un
 * FacturaRepository (in-memory en tests).
 */

import {
  emitirFacturaConRepo,
  anularFacturaConRepo,
  corregirFacturaConRepo,
} from '../factura-con-repo';
import { crearFacturaRepositoryInMemory } from './factura-repository-in-memory';
import { MENSAJES_ERROR_FACTURA, type EmitirFacturaInput } from '../types';
import { calcularHash } from '../../calculo/calculo';
import type { Liquidacion } from '../../calculo/types';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { ResultadoCalculo } from '../../motor-tarifario';

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
function resultadoBase(): ResultadoCalculo {
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
function liquidacionConId(id: string): Liquidacion {
  const base = {
    id,
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
    resultado: resultadoBase(),
    estado: 'ACTIVA' as const,
  };
  return { ...base, hash: calcularHash(base) };
}
function inputBase(overrides: Partial<EmitirFacturaInput> = {}): EmitirFacturaInput {
  return {
    suscriptor: suscriptorBase(),
    medidor: medidorBase(),
    periodo: periodoBase(),
    operario: operarioBase(),
    liquidacion: liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    consumosHistoricos: [],
    fechaEmision: '2026-02-01',
    consecutivo: 1,
    ...overrides,
  };
}

describe('emitirFacturaConRepo — happy path', () => {
  it('invoca emitirFactura puro, asigna id UUID y persiste via repo', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const factura = await emitirFacturaConRepo(inputBase(), repo);

    expect(factura.estado).toBe('BORRADOR');
    expect(factura.id).not.toBe('');
    expect(factura.numero_factura).toBe('MZ-001-1');

    const recuperada = await repo.buscarPorId(factura.id);
    expect(recuperada).toEqual(factura);
  });
});

describe('emitirFacturaConRepo — unicidad de numero_factura por periodo', () => {
  it('lanza NUMERO_FACTURA_DUPLICADO_EN_PERIODO si ya existe factura con mismo numero en el periodo', async () => {
    const repo = crearFacturaRepositoryInMemory();
    // Primera emision: consecutivo 1 → numero_factura "MZ-001-1" en periodo 202601.
    await emitirFacturaConRepo(inputBase(), repo);

    // Segunda emision con MISMO consecutivo y MISMO periodo → mismo numero_factura.
    // Cambiamos liquidacion para no chocar con LIQUIDACION_YA_FACTURADA primero.
    const inputDuplicado = inputBase({
      liquidacion: liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    });

    await expect(emitirFacturaConRepo(inputDuplicado, repo)).rejects.toThrow(
      MENSAJES_ERROR_FACTURA.NUMERO_FACTURA_DUPLICADO_EN_PERIODO,
    );
  });
});

describe('emitirFacturaConRepo — unicidad de liquidacion', () => {
  it('lanza LIQUIDACION_YA_FACTURADA si ya existe factura con la misma liquidacion', async () => {
    const repo = crearFacturaRepositoryInMemory();
    // Primera emision con liquidacion AAA, consecutivo 1.
    await emitirFacturaConRepo(inputBase(), repo);

    // Segunda emision con MISMA liquidacion pero consecutivo 2 (numero_factura distinto).
    // Debe rechazar por LIQUIDACION_YA_FACTURADA, no por numero duplicado.
    const inputMismaLiq = inputBase({ consecutivo: 2 });

    await expect(emitirFacturaConRepo(inputMismaLiq, repo)).rejects.toThrow(
      MENSAJES_ERROR_FACTURA.LIQUIDACION_YA_FACTURADA,
    );
  });
});

describe('anularFacturaConRepo — happy path', () => {
  it('recupera factura, llama anularFactura puro y persiste cambios via repo.actualizar', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const factura = await emitirFacturaConRepo(inputBase(), repo);
    // Transicion a EMITIDA via repo.actualizar (anularFactura puro solo
    // permite anular desde EMITIDA, no desde BORRADOR).
    await repo.actualizar(factura.id, { estado: 'EMITIDA' });

    const anulada = await anularFacturaConRepo(
      factura.id,
      'liquidacion corregida tras revision',
      repo,
    );

    expect(anulada.estado).toBe('ANULADA');
    expect(anulada.motivo_anulacion).toBe('liquidacion corregida tras revision');
    expect(anulada.id).toBe(factura.id);
    expect(anulada.numero_factura).toBe(factura.numero_factura);

    const recuperada = await repo.buscarPorId(factura.id);
    expect(recuperada).toEqual(anulada);
  });
});

// Marca usados para tsc — evitan unused warnings hasta que cycles posteriores los usen.
void corregirFacturaConRepo;
