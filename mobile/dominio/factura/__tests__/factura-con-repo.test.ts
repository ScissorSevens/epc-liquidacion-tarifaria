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
import type { Prestador } from '../../prestadores/types';
import type { Lectura } from '../../captura-lecturas/types';
import type { ResultadoCalculo } from '../../motor-tarifario';
import type { Hasher, IdGenerator } from '../../shared/ports';

const hasher: Hasher = { sha256: (input: string) => `hash-fake-${input.length}` };
let __uuidContador = 0;
const idGen: IdGenerator = {
  uuid: () => `uuid-fake-${String(++__uuidContador).padStart(8, '0')}`,
};

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
function resultadoBase(): ResultadoCalculo {
  return {
    id_prestador: 0, estrato: 4 as const, categoria_uso: 'residencial' as const, consumo_m3: 10, consumo_efectivo_m3: 10, bloques: [],
    cargo_fijo: 5000, cc_unitario: 1500, cc_total: 15000,
    subsidio: 0, contribucion: 0, total: 20000, factor_aplicado: 0, metadata: { norma_aplicada: 'X', acuerdo_id: null, parametros_id: 0, cmviaa_aplicado: false, minimo_vital_aplicado: false, factor_capeado: false, version_motor: 'X', calculo_timestamp: 'X' },
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
  return { ...base, hash: calcularHash(base, hasher) };
}
function inputBase(overrides: Partial<EmitirFacturaInput> = {}): EmitirFacturaInput {
  return {
    suscriptor: suscriptorBase(),
    medidor: medidorBase(),
    periodo: periodoBase(),
    operario: operarioBase(),
    prestador: prestadorBase(),
    lectura: lecturaBase(),
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
    const factura = await emitirFacturaConRepo(inputBase(), repo, hasher, idGen);

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
    await emitirFacturaConRepo(inputBase(), repo, hasher, idGen);

    // Segunda emision con MISMO consecutivo y MISMO periodo → mismo numero_factura.
    // Cambiamos liquidacion para no chocar con LIQUIDACION_YA_FACTURADA primero.
    const inputDuplicado = inputBase({
      liquidacion: liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    });

    await expect(emitirFacturaConRepo(inputDuplicado, repo, hasher, idGen)).rejects.toThrow(
      MENSAJES_ERROR_FACTURA.NUMERO_FACTURA_DUPLICADO_EN_PERIODO,
    );
  });
});

describe('emitirFacturaConRepo — unicidad de liquidacion', () => {
  it('lanza LIQUIDACION_YA_FACTURADA si ya existe factura con la misma liquidacion', async () => {
    const repo = crearFacturaRepositoryInMemory();
    // Primera emision con liquidacion AAA, consecutivo 1.
    await emitirFacturaConRepo(inputBase(), repo, hasher, idGen);

    // Segunda emision con MISMA liquidacion pero consecutivo 2 (numero_factura distinto).
    // Debe rechazar por LIQUIDACION_YA_FACTURADA, no por numero duplicado.
    const inputMismaLiq = inputBase({ consecutivo: 2 });

    await expect(emitirFacturaConRepo(inputMismaLiq, repo, hasher, idGen)).rejects.toThrow(
      MENSAJES_ERROR_FACTURA.LIQUIDACION_YA_FACTURADA,
    );
  });
});

describe('anularFacturaConRepo — happy path', () => {
  it('recupera factura, llama anularFactura puro y persiste cambios via repo.actualizar', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const factura = await emitirFacturaConRepo(inputBase(), repo, hasher, idGen);
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

describe('anularFacturaConRepo — persiste fecha_anulacion (W1)', () => {
  it('la factura recuperada del repo tiene fecha_anulacion no vacia', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const factura = await emitirFacturaConRepo(inputBase(), repo, hasher, idGen);
    await repo.actualizar(factura.id, { estado: 'EMITIDA' });

    await anularFacturaConRepo(factura.id, 'liquidacion corregida', repo);

    const recuperada = await repo.buscarPorId(factura.id);
    expect(recuperada?.fecha_anulacion).toBeTruthy();
    // ISO 8601 — orquestador usa new Date().toISOString()
    expect(recuperada?.fecha_anulacion).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('corregirFacturaConRepo — happy path', () => {
  it('valida facturaOriginal en repo, corrige puro, persiste UPDATE+CREATE y retorna pareja', async () => {
    const repo = crearFacturaRepositoryInMemory();
    // Setup: persistir factura original (con liquidacion AAA), transicionar a EMITIDA.
    const original = await emitirFacturaConRepo(inputBase(), repo, hasher, idGen);
    await repo.actualizar(original.id, { estado: 'EMITIDA' });
    const originalEmitida = (await repo.buscarPorId(original.id))!;

    // Liquidaciones: anulada (mismo id que la original) y nueva (id distinto).
    const liquidacionAnulada = liquidacionConId(originalEmitida.snapshot.liquidacion.id);
    const liquidacionNueva = liquidacionConId('cccccccc-cccc-cccc-cccc-cccccccccccc');

    const { facturaAnulada, nuevoBorrador } = await corregirFacturaConRepo(
      {
        facturaOriginal: originalEmitida,
        liquidacionAnulada,
        liquidacionNueva,
        consecutivoNuevo: 2,
        fechaEmision: '2026-02-15',
      },
      repo, hasher, idGen
    );

    // Aserciones del puro propagadas + persistencia.
    expect(facturaAnulada.estado).toBe('ANULADA');
    expect(facturaAnulada.id).toBe(originalEmitida.id);

    expect(nuevoBorrador.estado).toBe('BORRADOR');
    expect(nuevoBorrador.id).not.toBe('');
    expect(nuevoBorrador.id).not.toBe(originalEmitida.id);
    expect(nuevoBorrador.numero_factura).toBe('MZ-001-2');
    expect(nuevoBorrador.snapshot.liquidacion.id).toBe(liquidacionNueva.id);
    expect(nuevoBorrador.reemplaza_a).toBe(originalEmitida.id);

    // Persistencia: original ahora ANULADA en repo, nuevoBorrador recuperable.
    const recuperadaAnulada = await repo.buscarPorId(originalEmitida.id);
    expect(recuperadaAnulada?.estado).toBe('ANULADA');

    const recuperadoBorrador = await repo.buscarPorId(nuevoBorrador.id);
    expect(recuperadoBorrador).toEqual(nuevoBorrador);
  });
});
