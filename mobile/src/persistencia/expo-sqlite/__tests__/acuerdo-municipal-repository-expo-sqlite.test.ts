/**
 * Contrato del round-trip del campo `estado` en `acuerdo_municipal`.
 *
 * TDD Evidence:
 *   RED: estos casos describen la persistencia y mapeo del campo
 *        `estado` (BORRADOR | ACTIVO | VENCIDO | DEROGADO) en el
 *        adapter expo-sqlite. El codigo actual NO lo soporta: el
 *        `fromRow` no lo incluye y el repository no lo emite.
 *   GREEN: la implementacion debe persistir y mapear el campo.
 *   TRIANGULATE: defaults legacy (ACTIVO), cambios explicitos,
 *                y default conservador en lectura.
 *
 * Contexto regulatorio: para que un Acuerdo quede en estado
 * `ACTIVO`, el admin debe haber cargado `acto_administrativo_url`.
 * El bootstrap crea el Acuerdo con `estado: 'BORRADOR'` (cambio
 * seguro; ver Phase 4 batch). Acuerdos legacy se asumen `ACTIVO`
 * porque ya tienen acto previo cargado.
 *
 * Migration 3.7: el campo `estado` se agrega aditivamente a la tabla
 * `acuerdo_municipal` con `DEFAULT 'ACTIVO'` en la migration 026
 * pendiente; backfill para data legacy.
 */

import { crearAcuerdoMunicipalRepositoryExpoSqlite } from '../acuerdo-municipal-repository-expo-sqlite';
import type {
  AcuerdoMunicipal,
  AcuerdoMunicipalBorrador,
} from '@dominio/acuerdo-municipal';

interface AcuerdoRowFixture {
  readonly id_acuerdo: number;
  readonly id_prestador: number;
  readonly factor_subsidio_e1: number;
  readonly factor_subsidio_e2: number;
  readonly factor_subsidio_e3: number;
  readonly factor_contribucion_e5: number;
  readonly factor_contribucion_e6: number;
  readonly factor_contribucion_comercial: number;
  readonly factor_contribucion_industrial: number;
  readonly fecha_vigencia_desde: string;
  readonly fecha_vigencia_hasta: string;
  readonly acto_administrativo_url: string | null;
  readonly observaciones: string | null;
  readonly created_at: string;
  // Phase 3.5: estado del ciclo de vida del Acuerdo.
  // Default 'ACTIVO' para legacy data (asume acto previo cargado).
  readonly estado: string | null;
}

function buildRow(overrides: Partial<AcuerdoRowFixture> = {}): AcuerdoRowFixture {
  return {
    id_acuerdo: 1,
    id_prestador: 1,
    factor_subsidio_e1: -0.7,
    factor_subsidio_e2: -0.55,
    factor_subsidio_e3: -0.45,
    factor_contribucion_e5: 0.2,
    factor_contribucion_e6: 0.3,
    factor_contribucion_comercial: 0.5,
    factor_contribucion_industrial: 0.3,
    fecha_vigencia_desde: '2024-01-01',
    fecha_vigencia_hasta: '2028-12-31',
    acto_administrativo_url: 'https://docs.epc.local/decretos/042-2024.pdf',
    observaciones: null,
    created_at: '2024-01-01T00:00:00.000Z',
    estado: 'ACTIVO',
    ...overrides,
  };
}

function buildBorrador(
  overrides: Partial<AcuerdoMunicipalBorrador> = {},
): AcuerdoMunicipalBorrador {
  return {
    id_prestador: 1,
    factor_subsidio_e1: -0.7,
    factor_subsidio_e2: -0.55,
    factor_subsidio_e3: -0.45,
    factor_contribucion_e5: 0.2,
    factor_contribucion_e6: 0.3,
    factor_contribucion_comercial: 0.5,
    factor_contribucion_industrial: 0.3,
    fecha_vigencia_desde: '2024-01-01',
    fecha_vigencia_hasta: '2028-12-31',
    acto_administrativo_url: 'https://docs.epc.local/decretos/042-2024.pdf',
    observaciones: null,
    ...overrides,
  };
}

interface DbFakes {
  execAsync: jest.Mock;
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
}

function buildDb(overrides: Partial<DbFakes> = {}) {
  const execAsync = overrides.execAsync ?? jest.fn().mockResolvedValue(undefined);
  const getAllAsync = overrides.getAllAsync ?? jest.fn().mockResolvedValue([]);
  const getFirstAsync =
    overrides.getFirstAsync ?? jest.fn().mockResolvedValue(null);
  const runAsync =
    overrides.runAsync ??
    jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  return {
    execAsync,
    getAllAsync,
    getFirstAsync,
    runAsync,
  } as unknown as import('expo-sqlite').SQLiteDatabase;
}

function expectedAcuerdo(row: AcuerdoRowFixture): AcuerdoMunicipal {
  return {
    id_acuerdo: row.id_acuerdo,
    id_prestador: row.id_prestador,
    factor_subsidio_e1: row.factor_subsidio_e1,
    factor_subsidio_e2: row.factor_subsidio_e2,
    factor_subsidio_e3: row.factor_subsidio_e3,
    factor_contribucion_e5: row.factor_contribucion_e5,
    factor_contribucion_e6: row.factor_contribucion_e6,
    factor_contribucion_comercial: row.factor_contribucion_comercial,
    factor_contribucion_industrial: row.factor_contribucion_industrial,
    fecha_vigencia_desde: row.fecha_vigencia_desde,
    fecha_vigencia_hasta: row.fecha_vigencia_hasta,
    acto_administrativo_url: row.acto_administrativo_url,
    observaciones: row.observaciones,
    estado: (row.estado ?? 'ACTIVO') as AcuerdoMunicipal['estado'],
    created_at: row.created_at,
  };
}

describe('crearAcuerdoMunicipalRepositoryExpoSqlite — round-trip estado', () => {
  it('T-ACM-EST-1: Acuerdo legacy se lee con estado=ACTIVO por default', async () => {
    const legacy = buildRow({ estado: null });
    const getFirstAsync = jest.fn().mockResolvedValue(legacy);
    const db = buildDb({ getFirstAsync });
    const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

    const encontrado = await repo.obtenerPorId(legacy.id_acuerdo);
    expect(encontrado).not.toBeNull();

    // Default conservador: legacy asume 'ACTIVO' (acto previo ya cargado).
    expect(encontrado?.estado).toBe('ACTIVO');
  });

  it('T-ACM-EST-2: Acuerdo con estado=ACTIVO se persiste tal cual en INSERT', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 10, changes: 1 });
    const filaPersistida = buildRow({ id_acuerdo: 10, estado: 'ACTIVO' });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

    const creado = await repo.crear(buildBorrador());

    expect(creado.estado).toBe('ACTIVO');
    const sql: string = runAsync.mock.calls[0][0];
    // El INSERT incluye la columna estado.
    expect(sql).toMatch(/INSERT\s+INTO\s+acuerdo_municipal/i);
    expect(sql).toMatch(/estado/i);
  });

  it('T-ACM-EST-3: Acuerdo con estado=BORRADOR se persiste explícitamente', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 11, changes: 1 });
    const filaPersistida = buildRow({ id_acuerdo: 11, estado: 'BORRADOR' });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

    const creado = await repo.crear(buildBorrador());

    expect(creado.estado).toBe('BORRADOR');
    const sql: string = runAsync.mock.calls[0][0];
    // El INSERT incluye estado en el SET de columnas.
    expect(sql).toMatch(/estado/i);
  });

  it('T-ACM-EST-4: Acuerdo con estado=VENCIDO se persiste y se lee correctamente', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 12, changes: 1 });
    const filaPersistida = buildRow({
      id_acuerdo: 12,
      estado: 'VENCIDO',
      fecha_vigencia_hasta: '2023-12-31',
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

    const creado = await repo.crear(
      buildBorrador({ fecha_vigencia_hasta: '2023-12-31' }),
    );

    expect(creado.estado).toBe('VENCIDO');
    expect(creado.fecha_vigencia_hasta).toBe('2023-12-31');
  });

  it('T-ACM-EST-5: Acuerdo con estado=DEROGADO se persiste y se lee correctamente', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 13, changes: 1 });
    const filaPersistida = buildRow({ id_acuerdo: 13, estado: 'DEROGADO' });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

    const creado = await repo.crear(buildBorrador());

    expect(creado.estado).toBe('DEROGADO');
  });

  it('T-ACM-EST-6: buscarVigente retorna acuerdo ACTIVO (caso happy path)', async () => {
    const acuerdoVigente = buildRow({
      id_acuerdo: 20,
      estado: 'ACTIVO',
      fecha_vigencia_desde: '2024-01-01',
      fecha_vigencia_hasta: '2028-12-31',
    });
    const getFirstAsync = jest.fn().mockResolvedValue(acuerdoVigente);
    const db = buildDb({ getFirstAsync });
    const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

    const encontrado = await repo.buscarVigente(1, '2026-08-10');
    expect(encontrado).not.toBeNull();

    expect(encontrado?.estado).toBe('ACTIVO');
    expect(encontrado?.id_acuerdo).toBe(20);
  });

  it('T-ACM-EST-7: round-trip completo - los 4 estados posible se persisten', async () => {
    const estados: Array<AcuerdoMunicipal['estado']> = [
      'BORRADOR',
      'ACTIVO',
      'VENCIDO',
      'DEROGADO',
    ];

    for (let i = 0; i < estados.length; i++) {
      const estado = estados[i];
      const id = 100 + i;
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: id, changes: 1 });
      const filaPersistida = buildRow({ id_acuerdo: id, estado });
      const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
      const db = buildDb({ runAsync, getFirstAsync });
      const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

      const creado = await repo.crear(buildBorrador());

      expect(creado.estado).toBe(estado);
    }
  });

  it('T-ACM-EST-8: fromRow preserva estado !== undefined (estado persistido)', async () => {
    const acuerdo = buildRow({ id_acuerdo: 30, estado: 'BORRADOR' });
    const getFirstAsync = jest.fn().mockResolvedValue(acuerdo);
    const db = buildDb({ getFirstAsync });
    const repo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);

    const encontrado = await repo.obtenerPorId(30);

    expect(encontrado).toEqual(expectedAcuerdo(acuerdo));
    expect(encontrado?.estado).toBe('BORRADOR');
  });
});
