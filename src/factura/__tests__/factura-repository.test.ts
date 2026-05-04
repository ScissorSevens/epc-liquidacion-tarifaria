/**
 * Tests del helper `crearFacturaRepositoryInMemory` (in-memory FacturaRepository).
 *
 * Cubre los 6 metodos del puerto: crear, buscarPorId, buscarPorPeriodo,
 * buscarPorSuscriptor, actualizar, listar. Implementacion productiva
 * (SQLite) vive en Iter 7 — este helper sirve para tests de orquestadores
 * `*ConRepo` y para integracion entre modulos.
 */

import { crearFacturaRepositoryInMemory } from './factura-repository-in-memory';
import { emitirFactura } from '../factura';
import type { EmitirFacturaInput } from '../types';
import { MENSAJES_ERROR_FACTURA } from '../types';
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

describe('FacturaRepositoryInMemory — crear + buscarPorId', () => {
  it('crear persiste la factura y buscarPorId la recupera por id', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const factura = emitirFactura(inputBase());

    const creada = await repo.crear(factura);
    const recuperada = await repo.buscarPorId(factura.id);

    expect(creada).toBe(factura);
    expect(recuperada).toEqual(factura);
  });

  it('buscarPorId retorna null cuando el id no existe', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const recuperada = await repo.buscarPorId('id-inexistente');
    expect(recuperada).toBeNull();
  });
});

describe('FacturaRepositoryInMemory — buscarPorPeriodo', () => {
  it('retorna solo las facturas cuyo snapshot.periodo.id_periodo coincide', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const f1 = { ...emitirFactura(inputBase()), id: 'uuid-1' };
    const periodoFebrero: Periodo = {
      ...periodoBase(),
      id_periodo: '202602',
      nombre: 'Febrero 2026',
      fecha_inicio: '2026-02-01',
      fecha_fin: '2026-02-28',
    };
    const f2 = {
      ...emitirFactura(
        inputBase({ periodo: periodoFebrero, consecutivo: 2, fechaEmision: '2026-03-01' }),
      ),
      id: 'uuid-2',
    };
    const f3 = { ...emitirFactura(inputBase({ consecutivo: 3 })), id: 'uuid-3' };
    await repo.crear(f1);
    await repo.crear(f2);
    await repo.crear(f3);

    const enero = await repo.buscarPorPeriodo('202601');
    const febrero = await repo.buscarPorPeriodo('202602');
    const inexistente = await repo.buscarPorPeriodo('209912');

    expect(enero.map((f) => f.id).sort()).toEqual(['uuid-1', 'uuid-3']);
    expect(febrero.map((f) => f.id)).toEqual(['uuid-2']);
    expect(inexistente).toEqual([]);
  });
});

describe('FacturaRepositoryInMemory — buscarPorSuscriptor', () => {
  it('retorna solo las facturas cuyo snapshot.suscriptor.codigo coincide con String(idSuscriptor)', async () => {
    const repo = crearFacturaRepositoryInMemory();
    // Discrepancia conocida puerto vs snapshot: puerto pide id_suscriptor:number
    // pero snapshot guarda codigo:string. Helper in-memory matchea por
    // codigo === String(idSuscriptor) — los suscriptores de prueba usan ese contrato.
    const suscriptor1: Suscriptor = { ...suscriptorBase(), id_suscriptor: 1, codigo: '1' };
    const suscriptor2: Suscriptor = {
      ...suscriptorBase(),
      id_suscriptor: 2,
      codigo: '2',
      nombre_apellidos: 'Juan Pérez',
    };
    const f1 = { ...emitirFactura(inputBase({ suscriptor: suscriptor1 })), id: 'uuid-1' };
    const medidor2: Medidor = { ...medidorBase(), id_suscriptor: 2 };
    const f2 = {
      ...emitirFactura(
        inputBase({ suscriptor: suscriptor2, medidor: medidor2, consecutivo: 2 }),
      ),
      id: 'uuid-2',
    };
    await repo.crear(f1);
    await repo.crear(f2);

    const delUno = await repo.buscarPorSuscriptor(1);
    const delDos = await repo.buscarPorSuscriptor(2);
    const inexistente = await repo.buscarPorSuscriptor(999);

    expect(delUno.map((f) => f.id)).toEqual(['uuid-1']);
    expect(delDos.map((f) => f.id)).toEqual(['uuid-2']);
    expect(inexistente).toEqual([]);
  });
});

describe('FacturaRepositoryInMemory — listar', () => {
  it('retorna todas las facturas persistidas en orden de insercion', async () => {
    const repo = crearFacturaRepositoryInMemory();
    expect(await repo.listar()).toEqual([]);

    const f1 = { ...emitirFactura(inputBase()), id: 'uuid-1' };
    const f2 = {
      ...emitirFactura(inputBase({ consecutivo: 2 })),
      id: 'uuid-2',
    };
    await repo.crear(f1);
    await repo.crear(f2);

    const todas = await repo.listar();
    expect(todas.map((f) => f.id)).toEqual(['uuid-1', 'uuid-2']);
  });
});

describe('FacturaRepositoryInMemory — actualizar (happy path)', () => {
  it('aplica cambios parciales y retorna la factura actualizada persistida', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const f1 = { ...emitirFactura(inputBase()), id: 'uuid-1' };
    await repo.crear(f1);

    const actualizada = await repo.actualizar('uuid-1', {
      estado: 'ANULADA',
      motivo_anulacion: 'liquidacion corregida',
    });

    expect(actualizada.estado).toBe('ANULADA');
    expect(actualizada.motivo_anulacion).toBe('liquidacion corregida');
    expect(actualizada.id).toBe('uuid-1');
    expect(actualizada.numero_factura).toBe(f1.numero_factura);

    const recuperada = await repo.buscarPorId('uuid-1');
    expect(recuperada).toEqual(actualizada);
  });
});

describe('FacturaRepositoryInMemory — actualizar (no encontrada)', () => {
  it('lanza FACTURA_NO_ENCONTRADA si el id no existe', async () => {
    const repo = crearFacturaRepositoryInMemory();
    await expect(
      repo.actualizar('uuid-inexistente', { estado: 'ANULADA' }),
    ).rejects.toThrow(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
  });
});

describe('FacturaRepositoryInMemory — actualizar persiste fecha_anulacion (W1)', () => {
  it('al anular con fecha_anulacion, buscarPorId la devuelve íntegra', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const emitida = {
      ...emitirFactura(inputBase()),
      id: 'uuid-w1',
      estado: 'EMITIDA' as const,
    };
    await repo.crear(emitida);

    await repo.actualizar('uuid-w1', {
      estado: 'ANULADA',
      motivo_anulacion: 'liquidacion corregida',
      fecha_anulacion: '2026-03-15',
    });

    const recuperada = await repo.buscarPorId('uuid-w1');
    expect(recuperada?.fecha_anulacion).toBe('2026-03-15');
    expect(recuperada?.motivo_anulacion).toBe('liquidacion corregida');
    expect(recuperada?.estado).toBe('ANULADA');
  });
});

describe('FacturaRepositoryInMemory — actualizar valida transiciones legales (4.4)', () => {
  it('lanza TRANSICION_ILEGAL al intentar ANULADA → EMITIDA con cause estructurada', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const anulada = {
      ...emitirFactura(inputBase()),
      id: 'uuid-anulada',
      estado: 'ANULADA' as const,
    };
    await repo.crear(anulada);

    let capturado: Error | null = null;
    try {
      await repo.actualizar('uuid-anulada', { estado: 'EMITIDA' });
    } catch (e) {
      capturado = e as Error;
    }

    expect(capturado).not.toBeNull();
    expect(capturado!.message).toBe(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL);
    expect((capturado as Error & { cause?: unknown }).cause).toEqual({
      codigo: 'TRANSICION_ILEGAL',
      actual: 'ANULADA',
      intentada: 'EMITIDA',
    });
  });

  it('triangulación: rechaza PAGADA → EMITIDA con cause estructurada', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const pagada = {
      ...emitirFactura(inputBase()),
      id: 'uuid-pagada',
      estado: 'PAGADA' as const,
    };
    await repo.crear(pagada);

    let capturado: Error | null = null;
    try {
      await repo.actualizar('uuid-pagada', { estado: 'EMITIDA' });
    } catch (e) {
      capturado = e as Error;
    }

    expect(capturado).not.toBeNull();
    expect(capturado!.message).toBe(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL);
    expect((capturado as Error & { cause?: unknown }).cause).toEqual({
      codigo: 'TRANSICION_ILEGAL',
      actual: 'PAGADA',
      intentada: 'EMITIDA',
    });
  });

  it('idempotente: NO lanza cuando estado nuevo === estado actual (PAGADA → PAGADA)', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const pagada = {
      ...emitirFactura(inputBase()),
      id: 'uuid-idem',
      estado: 'PAGADA' as const,
    };
    await repo.crear(pagada);

    const resultado = await repo.actualizar('uuid-idem', { estado: 'PAGADA' });
    expect(resultado.estado).toBe('PAGADA');
    expect(resultado.id).toBe('uuid-idem');
  });
});

describe('FacturaRepositoryInMemory — crear valida unicidad por liquidacion_id (D7)', () => {
  it('lanza RESTRICCION_UNICIDAD si ya existe factura no-anulada con la misma liquidacion_id', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const liqId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const f1 = { ...emitirFactura(inputBase()), id: 'uuid-1' };
    await repo.crear(f1);

    const f2 = { ...emitirFactura(inputBase({ consecutivo: 2 })), id: 'uuid-2' };
    // Mismo liquidacion_id (inputBase usa siempre el mismo id 'aaaa...').
    expect(f2.snapshot.liquidacion.id).toBe(liqId);

    let capturado: Error | null = null;
    try {
      await repo.crear(f2);
    } catch (e) {
      capturado = e as Error;
    }

    expect(capturado).not.toBeNull();
    expect(capturado!.message).toBe(MENSAJES_ERROR_FACTURA.RESTRICCION_UNICIDAD);
    expect((capturado as Error & { cause?: unknown }).cause).toEqual({
      codigo: 'RESTRICCION_UNICIDAD',
      ctx: { liquidacion_id: liqId },
    });
  });
});
