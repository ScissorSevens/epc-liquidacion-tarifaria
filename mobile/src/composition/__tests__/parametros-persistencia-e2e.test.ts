import Database from 'better-sqlite3';

interface ExpoLikeDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

let mockExpoDb: ExpoLikeDb;

jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(async () => mockExpoDb),
}));

import { bootstrapApp, type BootstrapApp } from '../bootstrap';
import { bootstrapCompleto } from '../bootstrap-completo';
import { calcularCargos } from '../../../dominio/parametros-tarifa';
import { calcularLiquidacion } from '../../../dominio/motor-tarifario/motor-tarifario';
import { crearLiquidacion } from '../../../dominio/calculo/calculo';
import { emitirFacturaMovil } from '../../../dominio/factura/emitir-factura-movil';
import type { ParametrosTarifa } from '../../../dominio/parametros-tarifa';
import type { ResultadoCalculo } from '../../../dominio/motor-tarifario/types';

function createExpoLikeDb(rawDb: Database.Database): ExpoLikeDb {
  return {
    async execAsync(sql) {
      rawDb.exec(sql);
    },
    async runAsync(sql, ...params) {
      const result = rawDb.prepare(sql).run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      return rawDb.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      return (rawDb.prepare(sql).get(...params) ?? null) as T | null;
    },
    async withTransactionAsync(task) {
      rawDb.exec('BEGIN');
      try {
        await task();
        rawDb.exec('COMMIT');
      } catch (error) {
        rawDb.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() {
      rawDb.close();
    },
  };
}

const AHORA = new Date('2026-08-04T12:00:00.000Z');

async function crearTenant(app: BootstrapApp) {
  return bootstrapCompleto({
    prestadorRepo: app.repos.prestadorRepo,
    acuerdoRepo: app.repos.acuerdoMunicipalRepo,
    parametrosRepo: app.repos.parametrosTarifaRepo,
    operarioRepo: app.repos.operarioRepo,
    hasher: app.adapters.hasher,
    idGenerator: app.adapters.idGenerator,
    ahora: () => AHORA,
    input: {
      prestadorData: {
        nombre: 'Acueducto E2E',
        nit: '900123456-7',
        representante_legal: 'Ana Prueba',
        representante_legal_cedula: '1234567890',
        municipio: 'Caqueza',
        departamento: 'Cundinamarca',
        segmento: 2,
        num_suscriptores_urbanos: 0,
        num_suscriptores_rurales: 15,
        email: 'e2e@example.test',
        telefono: '3001234567',
        contacto: null,
        estado: 'activo',
        aps: null,
      },
      operarioData: {
        numero_cedula: '1010101010',
        nombre: 'Operario E2E',
        email: 'operario@example.test',
        password: 'clave-segura-e2e',
      },
    },
  });
}

async function emitirConParametros(
  app: BootstrapApp,
  parametros: ParametrosTarifa,
  tenant: Awaited<ReturnType<typeof crearTenant>>,
): Promise<ResultadoCalculo> {
  const lectura = {
    id_medidor: 1,
    id_periodo: '202607',
    id_operario: tenant.operario.id_operario,
    lectura_anterior: 0,
    lectura_actual: 10,
    estado_validacion: 'validado' as const,
    timestamp_captura: '2026-08-02T08:00:00.000Z',
    estado_sync: 'pendiente' as const,
    id_prestador: tenant.prestador.id_prestador,
  };
  const resultado = calcularLiquidacion(
    {
      id_prestador: tenant.prestador.id_prestador,
      estrato: 2,
      categoria_uso: 'residencial',
      consumo_m3: lectura.lectura_actual - lectura.lectura_anterior,
    },
    parametros,
    tenant.acuerdo,
  );
  const liquidacion = crearLiquidacion(
    { suscriptorId: '1', resultado },
    app.adapters.hasher,
    app.adapters.idGenerator,
  );
  const periodo = {
    id_periodo: '202607',
    nombre: 'Julio 2026',
    fecha_inicio: '2026-07-01',
    fecha_fin: '2026-07-31',
    fecha_pago_sin_recargo: '2026-08-15',
    fecha_pago_con_recargo: '2026-08-31',
    dias_consumo: 31,
    estado: 'cerrado' as const,
    created_at: '2026-07-01T00:00:00.000Z',
  };
  await app.repos.periodoRepo.guardar(periodo);
  await app.repos.liquidacionRepo.guardar(liquidacion);

  const factura = await emitirFacturaMovil(
    app,
    {
      lectura,
      id_suscriptor: 1,
      id_liquidacion: liquidacion.id,
      prestador: tenant.prestador,
      resultado,
      suscriptor: {
        id_suscriptor: 1,
        codigo: '1',
        nombre_apellidos: 'Suscriptor E2E',
        cedula: '2020202020',
        municipio: 'Caqueza',
        direccion: 'Vereda El Centro',
        estrato: 2,
        aplica_subsidio: true,
        estado: 'activo',
        id_prestador: tenant.prestador.id_prestador,
        categoria_uso: 'residencial',
        created_at: '2026-07-01T00:00:00.000Z',
      },
      medidor: {
        id_medidor: 1,
        numero_medidor: 'MED-E2E-1',
        id_suscriptor: 1,
        fecha_instalacion: '2025-01-01',
        estado: 'activo',
        created_at: '2025-01-01T00:00:00.000Z',
      },
      periodo,
      operario: tenant.operario,
      liquidacion,
      consumosHistoricos: [],
    },
    '2026-08-04',
  );

  return factura.snapshot.liquidacion.resultado;
}

describe('E2E parámetros persistidos → liquidación → factura móvil', () => {
  let rawDb: Database.Database;
  let app: BootstrapApp;

  beforeEach(async () => {
    rawDb = new Database(':memory:');
    rawDb.pragma('foreign_keys = ON');
    mockExpoDb = createExpoLikeDb(rawDb);
    app = await bootstrapApp();
  });

  afterEach(async () => {
    await app.db.closeAsync();
  });

  it('PARAM-E2E-1: parámetros custom persisten y se usan en el cálculo', async () => {
    const tenant = await crearTenant(app);
    const customBase = {
      ...tenant.parametros,
      cma: 10_000_000,
      cmo: 1_000,
      cmi: 300,
      cmt: 200,
      suscriptores_promedio: 15,
    };
    const cargos = calcularCargos(customBase);
    const guardados = await app.repos.parametrosTarifaRepo.guardar({
      ...customBase,
      cargo_fijo_resultante: cargos.cargo_fijo,
      cargo_consumo_resultante: cargos.cargo_consumo,
    });
    const releidos = await app.repos.parametrosTarifaRepo.buscarVigente(
      tenant.prestador.id_prestador,
      AHORA.toISOString(),
    );

    expect(releidos).toMatchObject({
      cma: 10_000_000,
      cmo: 1_000,
      cmi: 300,
      cmt: 200,
      suscriptores_promedio: 15,
      cargo_fijo_resultante: 10_000_000 / 15,
      cargo_consumo_resultante: 1_500,
    });

    const resultado = await emitirConParametros(app, guardados, tenant);
    const subtotal = resultado.cargo_fijo + resultado.cc_total;

    expect(resultado.total).not.toBe(100_001);
    expect(resultado.cargo_fijo).toBe(666_667);
    expect(resultado.cc_unitario).toBe(1_500);
    expect(resultado.cc_total).toBe(15_000);
    expect(resultado.factor_aplicado).toBe(-0.4);
    expect(resultado.subsidio).toBe(Math.round(subtotal * 0.4));
    expect(resultado.total).toBe(409_000);
  });

  it('PARAM-E2E-2: con defaults del bootstrap, el cálculo es consistente', async () => {
    const tenant = await crearTenant(app);
    const releidos = await app.repos.parametrosTarifaRepo.buscarVigente(
      tenant.prestador.id_prestador,
      AHORA.toISOString(),
    );

    expect(releidos).toMatchObject({
      cma: 5_000_000,
      cmo: 800,
      cmi: 200,
      cmt: 100,
      suscriptores_promedio: 15,
      cargo_fijo_resultante: 5_000_000 / 15,
      cargo_consumo_resultante: 1_100,
    });

    const resultado = await emitirConParametros(app, releidos!, tenant);
    const subtotal = resultado.cargo_fijo + resultado.cc_total;

    expect(resultado.total).not.toBe(100_001);
    expect(resultado.cargo_fijo).toBe(333_333);
    expect(resultado.cc_unitario).toBe(1_100);
    expect(resultado.cc_total).toBe(11_000);
    expect(resultado.factor_aplicado).toBe(-0.4);
    expect(resultado.subsidio).toBe(Math.round(subtotal * 0.4));
    expect(resultado.total).toBe(206_600);
  });
});
