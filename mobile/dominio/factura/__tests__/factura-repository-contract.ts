/**
 * Contract test reusable para `FacturaRepository`.
 *
 * Phase 6 Batch 3 (persistencia-sqlite): la SUITE de tests del puerto se
 * vuelve adapter-agnostic. Cualquier implementación nueva (in-memory hoy,
 * SQLite en Batch 4, etc.) se valida con la misma batería invocando
 * `runFacturaRepositoryContract(nombre, crearRepo, cleanupRepo?)`.
 *
 * Por qué un harness y no clases abstractas:
 * - Mantiene los tests como funciones puras, fáciles de leer y debuggear.
 * - Cada `describe` conserva nombre legible: "{adapter} — {scenario}".
 * - `cleanupRepo` opcional permite a adapters con I/O liberar recursos
 *   (ej. `db.close()` para SQLite). El in-memory no necesita nada.
 *
 * Cobertura del contract (mantener sincronizada con el spec del port):
 *  1. crear + buscarPorId (happy + null)
 *  2. buscarPorPeriodo
 *  3. buscarPorSuscriptor
 *  4. listar (orden de inserción)
 *  5. actualizar happy path
 *  6. actualizar FACTURA_NO_ENCONTRADA
 *  7. actualizar persiste fecha_anulacion (W1)
 *  8. actualizar valida transiciones legales (4.4)
 *  9. crear valida UNIQUE parcial D7 sobre liquidacion_id no-anulada
 */

import { emitirFactura } from '../factura';
import {
  MENSAJES_ERROR_FACTURA,
  type EmitirFacturaInput,
  type FacturaRepository,
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

const hasher: Hasher = { sha256: (input: string) => `hash-fake-${input.length}` };

// ---------- Builders compartidos ----------

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
    aps: null,
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

// ---------- Harness ----------

/**
 * Suite reusable. Cada adapter debe pasarla.
 *
 * @param nombre       Etiqueta humana del adapter (ej. 'FacturaRepositoryInMemory').
 * @param crearRepo    Factory sin args que devuelve un repo limpio.
 * @param cleanupRepo  Opcional. Se llama en `afterEach` con el último repo creado.
 */
export function runFacturaRepositoryContract(
  nombre: string,
  crearRepo: () => FacturaRepository,
  cleanupRepo?: (repo: FacturaRepository) => void | Promise<void>,
): void {
  let repo: FacturaRepository;

  beforeEach(() => {
    repo = crearRepo();
  });

  afterEach(async () => {
    if (cleanupRepo) await cleanupRepo(repo);
  });

  describe(`${nombre} — crear + buscarPorId`, () => {
    it('crear persiste la factura y buscarPorId la recupera por id', async () => {
      const factura = emitirFactura(inputBase(), hasher);
      const creada = await repo.crear(factura);
      const recuperada = await repo.buscarPorId(factura.id);
      expect(creada).toEqual(factura);
      expect(recuperada).toEqual(factura);
    });

    it('buscarPorId retorna null cuando el id no existe', async () => {
      const recuperada = await repo.buscarPorId('id-inexistente');
      expect(recuperada).toBeNull();
    });
  });

  describe(`${nombre} — buscarPorPeriodo`, () => {
    it('retorna solo las facturas cuyo snapshot.periodo.id_periodo coincide', async () => {
      const f1 = { ...emitirFactura(inputBase(), hasher), id: 'uuid-1' };
      const periodoFebrero: Periodo = {
        ...periodoBase(),
        id_periodo: '202602',
        nombre: 'Febrero 2026',
        fecha_inicio: '2026-02-01',
        fecha_fin: '2026-02-28',
      };
      const f2 = {
        ...emitirFactura(
          inputBase({
            periodo: periodoFebrero,
            consecutivo: 2,
            fechaEmision: '2026-03-01',
            liquidacion: liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
          }), hasher
        ),
        id: 'uuid-2',
      };
      const f3 = {
        ...emitirFactura(
          inputBase({
            consecutivo: 3,
            liquidacion: liquidacionConId('cccccccc-cccc-cccc-cccc-cccccccccccc'),
          }), hasher
        ),
        id: 'uuid-3',
      };
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

  describe(`${nombre} — buscarPorSuscriptor`, () => {
    it('retorna solo las facturas cuyo snapshot.suscriptor.codigo coincide con String(idSuscriptor)', async () => {
      const suscriptor1: Suscriptor = { ...suscriptorBase(), id_suscriptor: 1, codigo: '1' };
      const suscriptor2: Suscriptor = {
        ...suscriptorBase(),
        id_suscriptor: 2,
        codigo: '2',
        nombre_apellidos: 'Juan Pérez',
      };
      const f1 = { ...emitirFactura(inputBase({ suscriptor: suscriptor1 }), hasher), id: 'uuid-1' };
      const medidor2: Medidor = { ...medidorBase(), id_suscriptor: 2 };
      const f2 = {
        ...emitirFactura(
          inputBase({
            suscriptor: suscriptor2,
            medidor: medidor2,
            consecutivo: 2,
            liquidacion: liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
          }), hasher
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

  describe(`${nombre} — listar`, () => {
    it('retorna todas las facturas persistidas en orden de insercion', async () => {
      expect(await repo.listar()).toEqual([]);

      const f1 = { ...emitirFactura(inputBase(), hasher), id: 'uuid-1' };
      const f2 = {
        ...emitirFactura(
          inputBase({
            consecutivo: 2,
            liquidacion: liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
          }), hasher
        ),
        id: 'uuid-2',
      };
      await repo.crear(f1);
      await repo.crear(f2);

      const todas = await repo.listar();
      expect(todas.map((f) => f.id)).toEqual(['uuid-1', 'uuid-2']);
    });
  });

  describe(`${nombre} — actualizar (happy path)`, () => {
    it('aplica cambios parciales y retorna la factura actualizada persistida', async () => {
      const f1 = { ...emitirFactura(inputBase(), hasher), id: 'uuid-1' };
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

  describe(`${nombre} — actualizar (no encontrada)`, () => {
    it('lanza FACTURA_NO_ENCONTRADA si el id no existe', async () => {
      await expect(
        repo.actualizar('uuid-inexistente', { estado: 'ANULADA' }),
      ).rejects.toThrow(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
    });
  });

  describe(`${nombre} — actualizar persiste fecha_anulacion (W1)`, () => {
    it('al anular con fecha_anulacion, buscarPorId la devuelve íntegra', async () => {
      const emitida = {
        ...emitirFactura(inputBase(), hasher),
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

  describe(`${nombre} — actualizar valida transiciones legales (4.4)`, () => {
    it('lanza TRANSICION_ILEGAL al intentar ANULADA → EMITIDA con cause estructurada', async () => {
      const anulada = {
        ...emitirFactura(inputBase(), hasher),
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
      const pagada = {
        ...emitirFactura(inputBase(), hasher),
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
      const pagada = {
        ...emitirFactura(inputBase(), hasher),
        id: 'uuid-idem',
        estado: 'PAGADA' as const,
      };
      await repo.crear(pagada);

      const resultado = await repo.actualizar('uuid-idem', { estado: 'PAGADA' });
      expect(resultado.estado).toBe('PAGADA');
      expect(resultado.id).toBe('uuid-idem');
    });
  });

  describe(`${nombre} — crear valida unicidad por liquidacion_id (D7)`, () => {
    it('lanza RESTRICCION_UNICIDAD si ya existe factura no-anulada con la misma liquidacion_id', async () => {
      const liqId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const f1 = { ...emitirFactura(inputBase(), hasher), id: 'uuid-1' };
      await repo.crear(f1);

      const f2 = { ...emitirFactura(inputBase({ consecutivo: 2 }), hasher), id: 'uuid-2' };
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

    it('permite crear nueva factura si la única existente con ese liquidacion_id está ANULADA', async () => {
      const liqId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const f1 = {
        ...emitirFactura(inputBase(), hasher),
        id: 'uuid-anulada',
        estado: 'ANULADA' as const,
      };
      await repo.crear(f1);

      const f2 = {
        ...emitirFactura(inputBase({ consecutivo: 2 }), hasher),
        id: 'uuid-nueva',
      };
      expect(f2.snapshot.liquidacion.id).toBe(liqId);

      const creada = await repo.crear(f2);
      expect(creada.id).toBe('uuid-nueva');

      const recuperada = await repo.buscarPorId('uuid-nueva');
      expect(recuperada?.id).toBe('uuid-nueva');
    });

    it('actualizar a ANULADA libera el liquidacion_id para que un crear posterior funcione', async () => {
      const liqId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const f1 = {
        ...emitirFactura(inputBase(), hasher),
        id: 'uuid-1',
        estado: 'EMITIDA' as const,
      };
      await repo.crear(f1);

      await repo.actualizar('uuid-1', {
        estado: 'ANULADA',
        motivo_anulacion: 'corrige',
        fecha_anulacion: '2026-03-01',
      });

      const f2 = {
        ...emitirFactura(inputBase({ consecutivo: 2 }), hasher),
        id: 'uuid-2',
      };
      expect(f2.snapshot.liquidacion.id).toBe(liqId);

      const creada = await repo.crear(f2);
      expect(creada.id).toBe('uuid-2');
    });
  });
}
