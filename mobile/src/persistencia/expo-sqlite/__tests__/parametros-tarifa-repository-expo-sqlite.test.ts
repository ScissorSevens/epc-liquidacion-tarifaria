/**
 * Tests del UPSERT (`guardar`) en el adapter expo-sqlite de
 * ParametrosTarifa.
 *
 * Cobertura mínima:
 *   T-1: insert cuando NO hay fila con la triple clave → retorna fila
 *        nueva (id_parametros autogenerado).
 *   T-2: upsert cuando YA hay fila con la triple clave → retorna la
 *        MISMA fila actualizada (id_parametros estable).
 *   T-3: insert con misma (id_prestador, periodo) pero DIFERENTE
 *        vigente_desde → crea una NUEVA fila (otro id_parametros).
 *   T-4: persiste `cargo_fijo_resultante` y `cargo_consumo_resultante`
 *        correctamente (los cargos pre-calculados por `calcularCargos`).
 *
 * Estrategia RED/GREEN:
 *   - RED  → tests escritos contra el UPSERT real. Antes de la
 *            implementacion: el metodo `guardar` hace `throw new Error(
 *            'pendiente...')` (stub del Commit 1). Los tests fallan
 *            con el mensaje de la stub.
 *   - GREEN → reemplazar el stub con INSERT...ON CONFLICT(...) DO UPDATE.
 *            Mocks de SQLite capturan el SQL y responden con filas
 *            segun el caso.
 *   - TRIANGULATE → 4 casos con claves y outputs diferentes.
 *
 * Patron de mock: reutilizar `buildDb(...)` del archivo
 * operario-repository-expo-sqlite.test.ts — los metodos de
 * SQLiteDatabase que usa `guardar` son `runAsync` y `getFirstAsync`.
 */

import { crearParametrosTarifaRepositoryExpoSqlite } from '../parametros-tarifa-repository-expo-sqlite';
import type { ParametrosTarifa, ParametrosTarifaBorrador } from '../../../../dominio/parametros-tarifa';

// ── helpers ────────────────────────────────────────────────────────────────

function buildRow(overrides: Partial<ParametrosTarifaRow> = {}): ParametrosTarifaRow {
  return {
    id_parametros: 1,
    id_prestador: 7,
    id_acuerdo: 100,
    periodo: 2026,
    cma: 12_000_000,
    cmo: 500,
    cmi: 200,
    cmt: 100,
    cmviaa: 50,
    aplica_cmviaa: 1,
    agua_suministrada_m3_anio: 50_000,
    ipuf_m3_suscriptor_mes: 6,
    suscriptores_promedio: 1000,
    aplica_minimo_vital: 0,
    m3_gratis_minimo_vital: 0,
    ipuf_indice: 1.0,
    cargo_fijo_resultante: 12_000,
    cargo_consumo_resultante: 850,
    componentes_aplicables: '["CMA","CMO","CMI","CMT","CMVIAA"]',
    vigente_desde: '2025-01-01',
    vigente_hasta: '2029-12-31',
    created_at: '2026-07-28T00:00:00.000Z',
    ...overrides,
  };
}

interface ParametrosTarifaRow {
  readonly id_parametros: number;
  readonly id_prestador: number;
  readonly id_acuerdo: number;
  readonly periodo: number;
  readonly cma: number;
  readonly cmo: number;
  readonly cmi: number;
  readonly cmt: number;
  readonly cmviaa: number;
  readonly aplica_cmviaa: number;
  readonly agua_suministrada_m3_anio: number;
  readonly ipuf_m3_suscriptor_mes: number;
  readonly suscriptores_promedio: number;
  readonly aplica_minimo_vital: number;
  readonly m3_gratis_minimo_vital: number;
  readonly ipuf_indice: number;
  readonly cargo_fijo_resultante: number;
  readonly cargo_consumo_resultante: number;
  readonly componentes_aplicables: string;
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
  readonly created_at: string;
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

function buildBorrador(overrides: Partial<ParametrosTarifaBorrador> = {}): ParametrosTarifaBorrador {
  return {
    id_prestador: 7,
    id_acuerdo: 100,
    periodo: 2026,
    cma: 12_000_000,
    cmo: 500,
    cmi: 200,
    cmt: 100,
    cmviaa: 50,
    aplica_cmviaa: true,
    agua_suministrada_m3_anio: 50_000,
    ipuf_m3_suscriptor_mes: 6,
    suscriptores_promedio: 1000,
    aplica_minimo_vital: false,
    m3_gratis_minimo_vital: 0,
    ipuf_indice: 1.0,
    cargo_fijo_resultante: 12_000,
    cargo_consumo_resultante: 850,
    componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
    minimo_vital: null,
    vigente_desde: '2025-01-01',
    vigente_hasta: '2029-12-31',
    ...overrides,
  };
}

// ── guardas sobre SQL ──────────────────────────────────────────────────────

/**
 * Mockea `runAsync` para capturar el SQL del UPSERT y responder segun
 * el caso. El segundo `getFirstAsync` (post-upsert) lo provee el caller.
 */
function mockearRunAsyncQueHaceUpsert(
  lastInsertRowId: number,
  changes: number,
): jest.Mock {
  return jest.fn().mockResolvedValue({ lastInsertRowId, changes });
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('crearParametrosTarifaRepositoryExpoSqlite.guardar() — UPSERT', () => {
  it('T-GUARDAR-1: insert cuando no existe fila con la triple clave → id nuevo', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(42, 1);
    // Despues del UPSERT el repo hace SELECT para devolver el row completo.
    const filaNueva = buildRow({ id_parametros: 42 });
    const getFirstAsync = jest.fn().mockResolvedValue(filaNueva);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(buildBorrador());

    // T-GUARDAR-1 — id_parametros resultante es el nuevo (42).
    expect(resultado.id_parametros).toBe(42);
    expect(resultado.id_prestador).toBe(7);
    expect(resultado.periodo).toBe(2026);
    // Sanity: el UPSERT fue invocado una vez.
    expect(runAsync).toHaveBeenCalledTimes(1);
    // El SQL debe usar INSERT ... ON CONFLICT y apuntar a la triple
    // clave del UNIQUE.
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/INSERT\s+INTO\s+parametros_tarifa/i);
    expect(sql).toMatch(/ON\s+CONFLICT\s*\(\s*id_prestador\s*,\s*periodo\s*,\s*vigente_desde\s*\)/i);
    expect(sql).toMatch(/DO\s+UPDATE/i);
  });

  it('T-GUARDAR-2: upsert cuando ya existe fila con la triple clave → mismo id', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(7, 1); // id existente
    const filaExistente = buildRow({
      id_parametros: 7,
      cma: 12_000_000,
      suscriptores_promedio: 500, // actualizado
      cargo_fijo_resultante: 24_000, // recalculado
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaExistente);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({ suscriptores_promedio: 500, cma: 12_000_000 }),
    );

    // id_parametros estable (mismo que la fila existente).
    expect(resultado.id_parametros).toBe(7);
    expect(resultado.suscriptores_promedio).toBe(500);
    // El DO UPDATE SET debe nombrar suscriptores_promedio y cma
    // (los 17 campos, excluyendo id_parametros y created_at).
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/DO\s+UPDATE\s+SET/i);
    expect(sql).toMatch(/suscriptores_promedio\s*=\s*excluded\.suscriptores_promedio/i);
    expect(sql).toMatch(/cma\s*=\s*excluded\.cma/i);
  });

  it('T-GUARDAR-3: misma (id_prestador, periodo) pero diferente vigente_desde → id nuevo', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(99, 1);
    // Despues del UPSERT, el SELECT por (id_prestador, periodo,
    // vigente_desde) devuelve la fila con la NUEVA vigente_desde.
    const filaNueva = buildRow({
      id_parametros: 99,
      id_prestador: 7,
      periodo: 2026,
      vigente_desde: '2026-06-01', // distinto al 2025-01-01
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaNueva);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({
        vigente_desde: '2026-06-01',
        vigente_hasta: '2030-12-31',
      }),
    );

    // La nueva fila tiene id_parametros 99 (distinto al 7 de la previa).
    expect(resultado.id_parametros).toBe(99);
    expect(resultado.vigente_desde).toBe('2026-06-01');
    // El WHERE del SELECT post-UPSERT debe apuntar a la triple clave
    // (no por id_parametros — el UPSERT puede haber actualizado la fila
    // existente o insertado una nueva, y queremos la NUEVA por clave).
    const selectSql: string = getFirstAsync.mock.calls[0][0];
    expect(selectSql).toMatch(/WHERE\s+id_prestador\s*=\s*\?/i);
    expect(selectSql).toMatch(/AND\s+periodo\s*=\s*\?/i);
    expect(selectSql).toMatch(/AND\s+vigente_desde\s*=\s*\?/i);
  });

  it('T-GUARDAR-4: persiste cargo_fijo_resultante y cargo_consumo_resultante', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(11, 1);
    // La fila persistida ya trae los cargos pre-calculados por la UI.
    const filaPersistida = buildRow({
      id_parametros: 11,
      cargo_fijo_resultante: 12_345, // specific magic number para distinguir
      cargo_consumo_resultante: 875,
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({
        cargo_fijo_resultante: 12_345,
        cargo_consumo_resultante: 875,
      }),
    );

    // El repositorio devuelve los cargos pre-calculados, NO los recalcula.
    expect(resultado.cargo_fijo_resultante).toBe(12_345);
    expect(resultado.cargo_consumo_resultante).toBe(875);
    // El DO UPDATE SET debe propagar los cargos.
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/cargo_fijo_resultante\s*=\s*excluded\.cargo_fijo_resultante/i);
    expect(sql).toMatch(/cargo_consumo_resultante\s*=\s*excluded\.cargo_consumo_resultante/i);
  });

  it('T-GUARDAR-5: rechaza cuando el row post-UPSERT no existe (defensiva)', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(1, 1);
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    await expect(repo.guardar(buildBorrador())).rejects.toThrow(/guardar/);
  });
});
