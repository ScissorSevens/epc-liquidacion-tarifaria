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
    anio_base: 2016,
    factor_indexacion_ipc: 1.0,
    cmaa: null,
    aplica_cmaa: 0,
    acto_adopcion: null,
    estudio_costos_id: null,
    documento_soporte_url: null,
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
  readonly anio_base: number;
  readonly factor_indexacion_ipc: number;
  readonly cmaa: number | null;
  readonly aplica_cmaa: number;
  readonly acto_adopcion: string | null;
  readonly estudio_costos_id: string | null;
  readonly documento_soporte_url: string | null;
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
    anio_base: 2016,
    factor_indexacion_ipc: 1.0,
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

  it('T-GUARDAR-6: persiste anio_base y factor_indexacion_ipc', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(33, 1);
    const filaPersistida = buildRow({
      id_parametros: 33,
      anio_base: 2020,
      factor_indexacion_ipc: 1.5,
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({ anio_base: 2020, factor_indexacion_ipc: 1.5 }),
    );

    expect(resultado.anio_base).toBe(2020);
    expect(resultado.factor_indexacion_ipc).toBe(1.5);
    const sql: string = runAsync.mock.calls[0][0];
    // El INSERT incluye anio_base y factor_indexacion_ipc.
    expect(sql).toMatch(/anio_base/i);
    expect(sql).toMatch(/factor_indexacion_ipc/i);
    // El DO UPDATE SET los propaga.
    expect(sql).toMatch(/anio_base\s*=\s*excluded\.anio_base/i);
    expect(sql).toMatch(/factor_indexacion_ipc\s*=\s*excluded\.factor_indexacion_ipc/i);
  });

  it('T-GUARDAR-5: rechaza cuando el row post-UPSERT no existe (defensiva)', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(1, 1);
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    await expect(repo.guardar(buildBorrador())).rejects.toThrow(/guardar/);
  });

  it('T-GUARDAR-6: persiste anio_base y factor_indexacion_ipc', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(33, 1);
    const filaPersistida = buildRow({
      id_parametros: 33,
      anio_base: 2020,
      factor_indexacion_ipc: 1.5,
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({ anio_base: 2020, factor_indexacion_ipc: 1.5 }),
    );

    expect(resultado.anio_base).toBe(2020);
    expect(resultado.factor_indexacion_ipc).toBe(1.5);
    const sql: string = runAsync.mock.calls[0][0];
    // El INSERT incluye anio_base y factor_indexacion_ipc.
    expect(sql).toMatch(/anio_base/i);
    expect(sql).toMatch(/factor_indexacion_ipc/i);
    // El DO UPDATE SET los propaga.
    expect(sql).toMatch(/anio_base\s*=\s*excluded\.anio_base/i);
    expect(sql).toMatch(/factor_indexacion_ipc\s*=\s*excluded\.factor_indexacion_ipc/i);
  });

  // ── Phase 3.1 RED: round-trip cmaa + acto_adopcion + estudio_costos_id + documento_soporte_url ──
  it('T-GUARDAR-CMA-1: persiste cmaa (CMAA art. 31.B Res CRA 907/2019) en UPSERT', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(50, 1);
    const filaPersistida = buildRow({
      id_parametros: 50,
      cmaa: 250_000,
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(buildBorrador({ cmaa: 250_000 }));

    expect(resultado.cmaa).toBe(250_000);
    const sql: string = runAsync.mock.calls[0][0];
    // El INSERT incluye cmaa.
    expect(sql).toMatch(/cmaa/i);
    // El DO UPDATE SET propaga cmaa.
    expect(sql).toMatch(/cmaa\s*=\s*excluded\.cmaa/i);
  });

  it('T-GUARDAR-CMA-2: persiste acto_adopcion (URL del acto administrativo) en UPSERT', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(51, 1);
    const filaPersistida = buildRow({
      id_parametros: 51,
      acto_adopcion: 'Decreto 042 de 2024 alcaldia de Cáqueza',
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({ acto_adopcion: 'Decreto 042 de 2024 alcaldia de Cáqueza' }),
    );

    expect(resultado.acto_adopcion).toBe('Decreto 042 de 2024 alcaldia de Cáqueza');
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/acto_adopcion/i);
    expect(sql).toMatch(/acto_adopcion\s*=\s*excluded\.acto_adopcion/i);
  });

  it('T-GUARDAR-CMA-3: persiste estudio_costos_id (referencia externa SUI) en UPSERT', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(52, 1);
    const filaPersistida = buildRow({
      id_parametros: 52,
      estudio_costos_id: 'SUI-EC-2024-0042',
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({ estudio_costos_id: 'SUI-EC-2024-0042' }),
    );

    expect(resultado.estudio_costos_id).toBe('SUI-EC-2024-0042');
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/estudio_costos_id/i);
    expect(sql).toMatch(/estudio_costos_id\s*=\s*excluded\.estudio_costos_id/i);
  });

  it('T-GUARDAR-CMA-4: persiste documento_soporte_url (PDF del estudio) en UPSERT', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(53, 1);
    const filaPersistida = buildRow({
      id_parametros: 53,
      documento_soporte_url: 'https://docs.epc.local/estudios/2024-0042.pdf',
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({ documento_soporte_url: 'https://docs.epc.local/estudios/2024-0042.pdf' }),
    );

    expect(resultado.documento_soporte_url).toBe('https://docs.epc.local/estudios/2024-0042.pdf');
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/documento_soporte_url/i);
    expect(sql).toMatch(/documento_soporte_url\s*=\s*excluded\.documento_soporte_url/i);
  });

  it('T-GUARDAR-CMA-5: round-trip completo con los 4 campos nuevos (cmaa + 3 docs)', async () => {
    const runAsync = mockearRunAsyncQueHaceUpsert(54, 1);
    const filaPersistida = buildRow({
      id_parametros: 54,
      cmaa: 375_500,
      acto_adopcion: 'Resolución 017 de 2025',
      estudio_costos_id: 'SUI-EC-2025-0001',
      documento_soporte_url: 'https://docs.epc.local/estudios/2025-0001.pdf',
    });
    const getFirstAsync = jest.fn().mockResolvedValue(filaPersistida);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearParametrosTarifaRepositoryExpoSqlite(db);

    const resultado = await repo.guardar(
      buildBorrador({
        cmaa: 375_500,
        acto_adopcion: 'Resolución 017 de 2025',
        estudio_costos_id: 'SUI-EC-2025-0001',
        documento_soporte_url: 'https://docs.epc.local/estudios/2025-0001.pdf',
      }),
    );

    // Los 4 campos vienen de la fila persistida (round-trip).
    expect(resultado.cmaa).toBe(375_500);
    expect(resultado.acto_adopcion).toBe('Resolución 017 de 2025');
    expect(resultado.estudio_costos_id).toBe('SUI-EC-2025-0001');
    expect(resultado.documento_soporte_url).toBe('https://docs.epc.local/estudios/2025-0001.pdf');
    // El SQL incluye los 4 nombres (case-insensitive).
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/cmaa/i);
    expect(sql).toMatch(/acto_adopcion/i);
    expect(sql).toMatch(/estudio_costos_id/i);
    expect(sql).toMatch(/documento_soporte_url/i);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Phase 1 task 1.3 (RED) — Migration 028: altitud_msnm persiste.
  //
  // Res CRA 750/2016 art. 3: la altitud del prestador determina el
  // límite de consumo básico (11/13/16 m³/mes). Vive en el domain type
  // desde `compliance-cra-825-subsidios-bloques` pero NO se persistía
  // en SQLite (migration 025 no la incluye).
  //
  // Estos tests verifican el round-trip real con SQLite (node:sqlite):
  // el helper `aplicarMigrationAditivaIdempotenteNode` debe agregar la
  // columna y la columna debe aceptar tanto INTEGER como NULL (legacy
  // data sin altitud persiste con NULL).
  //
  // RED: el primer test verifica que la constante
  // `MIGRACION_028_PARAMETROS_ALTITUD` exista en
  // `mobile/src/persistencia/expo-sqlite/migraciones.ts` — al no
  // existir, el test falla. Los tests T-ALTITUD-* aplican ese SQL via
  // el helper aditivo y verifican el round-trip real. Esto bloquea
  // hasta que la implementación GREEN (task 1.4) defina la constante.
  // ─────────────────────────────────────────────────────────────────────
  describe('Phase 1 task 1.3 — altitud_msnm persiste (SQLite real)', () => {
    // SQL esperado de la migration 028 (debe coincidir verbatim con el
    // codigo de produccion que se agregara en task 1.4 GREEN).
    const SQL_MIGRACION_028_ALTITUD = `
      ALTER TABLE parametros_tarifa ADD COLUMN altitud_msnm INTEGER NULL;
    `;

    // Schema base reducido de `parametros_tarifa` (sin FKs a prestador /
    // acuerdo_municipal — el test se enfoca en la nueva columna, no en
    // las FKs pre-existentes).
    const SQL_SCHEMA_PARAMETROS_BASE = `
      CREATE TABLE parametros_tarifa (
        id_parametros INTEGER PRIMARY KEY,
        id_prestador  INTEGER NOT NULL,
        id_acuerdo    INTEGER NOT NULL,
        periodo       INTEGER NOT NULL,
        cma           REAL    NOT NULL,
        cmo           REAL    NOT NULL,
        cmi           REAL    NOT NULL,
        cmt           REAL    NOT NULL
      );
    `;

    function buildDbConSchemaBase(): import('node:sqlite').DatabaseSync {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
      const db = new DatabaseSync(':memory:');
      db.exec(SQL_SCHEMA_PARAMETROS_BASE);
      return db;
    }

    it('T-ALTITUD-0: la constante MIGRACION_028_PARAMETROS_ALTITUD existe en migraciones.ts', () => {
      // RED puro: la constante NO existe en el codigo de produccion
      // todavia. Este test falla hasta que la task 1.4 GREEN la cree.
      // Leemos el source del archivo migraciones.ts y verificamos que
      // el nombre aparece al menos una vez (declaracion + uso en array
      // MIGRACIONES + dispatch).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path') as typeof import('path');
      const ruta = path.join(__dirname, '..', 'migraciones.ts');
      const source = fs.readFileSync(ruta, 'utf8');
      expect(source).toMatch(/MIGRACION_028_PARAMETROS_ALTITUD/);
    });

    it('T-ALTITUD-1: round-trip altitud_msnm=2500 desde INSERT hasta SELECT', () => {
      const db = buildDbConSchemaBase();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { aplicarMigrationAditivaIdempotenteNode } = require('../../../../dominio/persistencia/sqlite/migraciones-idempotente');
        aplicarMigrationAditivaIdempotenteNode(db, SQL_MIGRACION_028_ALTITUD);

        const cols = db.prepare("PRAGMA table_info(parametros_tarifa)").all() as Array<{
          name: string;
          type: string;
          notnull: 0 | 1;
          dflt_value: string | null;
        }>;
        const col = cols.find((c) => c.name === 'altitud_msnm');
        expect(col).toBeDefined();
        expect(col!.type).toMatch(/INTEGER/i);
        expect(col!.notnull).toBe(0);

        db.prepare(
          `INSERT INTO parametros_tarifa
            (id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, altitud_msnm)
           VALUES (1, 7, 100, 2026, 12000000, 500, 200, 100, 2500)`,
        ).run();

        const row = db.prepare(
          "SELECT altitud_msnm FROM parametros_tarifa WHERE id_parametros = 1",
        ).get() as { altitud_msnm: number | null };
        expect(row.altitud_msnm).toBe(2500);
      } finally {
        db.close();
      }
    });

    it('T-ALTITUD-2: round-trip altitud_msnm=NULL preserva data legacy', () => {
      const db = buildDbConSchemaBase();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { aplicarMigrationAditivaIdempotenteNode } = require('../../../../dominio/persistencia/sqlite/migraciones-idempotente');
        aplicarMigrationAditivaIdempotenteNode(db, SQL_MIGRACION_028_ALTITUD);

        db.prepare(
          `INSERT INTO parametros_tarifa
            (id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, altitud_msnm)
           VALUES (2, 7, 100, 2026, 12000000, 500, 200, 100, NULL)`,
        ).run();

        const row = db.prepare(
          "SELECT altitud_msnm FROM parametros_tarifa WHERE id_parametros = 2",
        ).get() as { altitud_msnm: number | null };
        expect(row.altitud_msnm).toBeNull();
      } finally {
        db.close();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Phase 1 task 1.5 (RED) — Migration 028b + calcularFactorIpc.
  //
  // Res CRA 825/2017 Art. 11: formula de indexacion IPC
  //   factor = IPC[anio_destino] / IPC[anio_base].
  // El campo `anio_destino_indexacion` debe persistirse para que el
  // motor pueda calcular el factor sin asumir `anio_destino = anio_base`.
  //
  // RED: T-IPC-DEST-0 verifica que la constante
  // `MIGRACION_028B_PARAMETROS_ANIO_DESTINO` exista en `migraciones.ts`.
  // Como NO existe aun, este test falla.
  //
  // T-IPC-CALC-*: triangulacion sobre `calcularFactorIpc` del dominio.
  // La funcion ya existe (cambio `param-tarifa-res-825-compliance-phase1`)
  // y esta testeada en `dominio/parametros-tarifa/__tests__/ipc.test.ts`.
  // Aqui agregamos 3 tests adicionales en el archivo del repo para
  // mantener paridad con el task description (cubren los 3 escenarios
  // canonicos del Art. 11: mismo anio, destino > base, destino < base).
  // ─────────────────────────────────────────────────────────────────────
  describe('Phase 1 task 1.5 — anio_destino_indexacion persiste + calcularFactorIpc', () => {
    // SQL esperado de la migration 028b (task 1.6 GREEN).
    const SQL_MIGRACION_028B_ANIO_DESTINO = `
      ALTER TABLE parametros_tarifa ADD COLUMN anio_destino_indexacion INTEGER NULL;
    `;

    // Schema base reducido (reuso del describe anterior via funcion local).
    const SQL_SCHEMA_PARAMETROS_BASE_2 = `
      CREATE TABLE parametros_tarifa (
        id_parametros INTEGER PRIMARY KEY,
        id_prestador  INTEGER NOT NULL,
        id_acuerdo    INTEGER NOT NULL,
        periodo       INTEGER NOT NULL,
        cma           REAL    NOT NULL,
        cmo           REAL    NOT NULL,
        cmi           REAL    NOT NULL,
        cmt           REAL    NOT NULL,
        anio_base     INTEGER NOT NULL DEFAULT 2016
      );
    `;

    function buildDbConSchemaBase2(): import('node:sqlite').DatabaseSync {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
      const db = new DatabaseSync(':memory:');
      db.exec(SQL_SCHEMA_PARAMETROS_BASE_2);
      return db;
    }

    it('T-IPC-DEST-0: la constante MIGRACION_028B_PARAMETROS_ANIO_DESTINO existe en migraciones.ts', () => {
      // RED puro: la constante NO existe en el codigo de produccion
      // todavia. Este test falla hasta que la task 1.6 GREEN la cree.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path') as typeof import('path');
      const ruta = path.join(__dirname, '..', 'migraciones.ts');
      const source = fs.readFileSync(ruta, 'utf8');
      expect(source).toMatch(/MIGRACION_028B_PARAMETROS_ANIO_DESTINO/);
    });

    it('T-IPC-DEST-1: round-trip anio_destino_indexacion=2026 con factor IPC[2026]/IPC[2016]', () => {
      const db = buildDbConSchemaBase2();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { aplicarMigrationAditivaIdempotenteNode } = require('../../../../dominio/persistencia/sqlite/migraciones-idempotente');
        aplicarMigrationAditivaIdempotenteNode(db, SQL_MIGRACION_028B_ANIO_DESTINO);

        // PRAGMA table_info confirma la nueva columna.
        const cols = db.prepare("PRAGMA table_info(parametros_tarifa)").all() as Array<{
          name: string;
          type: string;
          notnull: 0 | 1;
        }>;
        const col = cols.find((c) => c.name === 'anio_destino_indexacion');
        expect(col).toBeDefined();
        expect(col!.type).toMatch(/INTEGER/i);
        expect(col!.notnull).toBe(0);

        // INSERT con anio_destino = 2026 (factor IPC[2026]/IPC[2016] = 1.6234).
        db.prepare(
          `INSERT INTO parametros_tarifa
            (id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt,
             anio_base, anio_destino_indexacion)
           VALUES (1, 7, 100, 2026, 12000000, 500, 200, 100, 2016, 2026)`,
        ).run();

        const row = db.prepare(
          `SELECT anio_base, anio_destino_indexacion
           FROM parametros_tarifa WHERE id_parametros = 1`,
        ).get() as { anio_base: number; anio_destino_indexacion: number | null };
        expect(row.anio_base).toBe(2016);
        expect(row.anio_destino_indexacion).toBe(2026);

        // El factor calculado por el dominio debe matchear el esperado.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { calcularFactorIpc } = require('../../../../dominio/parametros-tarifa/ipc');
        const factor = calcularFactorIpc(row.anio_base, row.anio_destino_indexacion);
        expect(factor).toBeCloseTo(1.6234, 2);
      } finally {
        db.close();
      }
    });

    it('T-IPC-DEST-2: round-trip anio_destino_indexacion=NULL preserva data legacy', () => {
      const db = buildDbConSchemaBase2();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { aplicarMigrationAditivaIdempotenteNode } = require('../../../../dominio/persistencia/sqlite/migraciones-idempotente');
        aplicarMigrationAditivaIdempotenteNode(db, SQL_MIGRACION_028B_ANIO_DESTINO);

        // INSERT sin anio_destino (legacy data, NULL es valido).
        db.prepare(
          `INSERT INTO parametros_tarifa
            (id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt,
             anio_base, anio_destino_indexacion)
           VALUES (2, 7, 100, 2026, 12000000, 500, 200, 100, 2016, NULL)`,
        ).run();

        const row = db.prepare(
          "SELECT anio_destino_indexacion FROM parametros_tarifa WHERE id_parametros = 2",
        ).get() as { anio_destino_indexacion: number | null };
        expect(row.anio_destino_indexacion).toBeNull();
      } finally {
        db.close();
      }
    });

    // Triangulacion: tests del dominio `calcularFactorIpc` para
    // mantener paridad con task 1.5 del change. La funcion ya existe
    // y esta testeada en `dominio/parametros-tarifa/__tests__/ipc.test.ts`
    // (T-IPC-3, T-IPC-6, T-IPC-7). Estos tests adicionales viven en el
    // archivo del repo como regression guard contractual.
    it('T-IPC-CALC-1: calcularFactorIpc mismo anio retorna 1.0', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calcularFactorIpc } = require('../../../../dominio/parametros-tarifa/ipc');
      expect(calcularFactorIpc(2016, 2016)).toBe(1.0);
      expect(calcularFactorIpc(2020, 2020)).toBe(1.0);
      expect(calcularFactorIpc(2026, 2026)).toBe(1.0);
    });

    it('T-IPC-CALC-2: calcularFactorIpc destino > base retorna > 1.0 (acumulacion)', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calcularFactorIpc } = require('../../../../dominio/parametros-tarifa/ipc');
      expect(calcularFactorIpc(2016, 2026)).toBeGreaterThan(1.0);
      expect(calcularFactorIpc(2016, 2020)).toBeGreaterThan(1.0);
    });

    it('T-IPC-CALC-3: calcularFactorIpc destino < base retorna < 1.0 (deflacion)', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calcularFactorIpc } = require('../../../../dominio/parametros-tarifa/ipc');
      expect(calcularFactorIpc(2026, 2016)).toBeLessThan(1.0);
      expect(calcularFactorIpc(2020, 2016)).toBeLessThan(1.0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Phase 2 task 2.1 (RED) — Migration 030: flag `aplica_cmaa`
  // explicito (Res CRA 907/2019 art. 13).
  //
  // Antes de Phase 2 el campo `cmaa` se inferia de `cmaa > 0`. Riesgo:
  // un admin que setea `cmaa = 0` por error → el motor NO incluye CMAA
  // sin warning. Fix: columna SQL `aplica_cmaa INTEGER NOT NULL DEFAULT 0
  // CHECK (aplica_cmaa IN (0, 1))` + toggle explicito en pantalla +
  // dominio.
  //
  // El flag es la fuente de verdad (decision B/B/B): si flag=false,
  // `cmaa` se sobrescribe con 0 en el buildBorradorLocal. Si flag=true
  // y `cmaa=null` (legacy data) → guarda OK (la migration aplica el
  // default 0 pero el form permite editarlo despues).
  //
  // RED: T-CMAA-0 verifica que la constante
  // `MIGRACION_030_PARAMETROS_APLICA_CMAA` exista en `migraciones.ts`.
  // T-CMAA-1/2/3 verifican el round-trip real con SQLite (node:sqlite).
  // ─────────────────────────────────────────────────────────────────────
  describe('Phase 2 task 2.1 — flag `aplica_cmaa` explicito (SQLite real)', () => {
    // SQL esperado de la migration 030 (debe coincidir verbatim con el
    // codigo de produccion que se agregara en task 2.2 GREEN). Mantener
    // la forma exacta para que el helper aditivo la procese bien.
    const SQL_MIGRACION_030_APLICA_CMAA = `
      ALTER TABLE parametros_tarifa ADD COLUMN aplica_cmaa INTEGER NOT NULL DEFAULT 0
        CHECK (aplica_cmaa IN (0, 1));
    `;

    // Schema base reducido — replica la forma minima que requiere
    // `aplicarMigrationAditivaIdempotenteNode`. La columna `aplica_cmaa`
    // NO existe todavia en el schema; la migration la agrega.
    const SQL_SCHEMA_PARAMETROS_BASE_3 = `
      CREATE TABLE parametros_tarifa (
        id_parametros INTEGER PRIMARY KEY,
        id_prestador  INTEGER NOT NULL,
        id_acuerdo    INTEGER NOT NULL,
        periodo       INTEGER NOT NULL,
        cma           REAL    NOT NULL,
        cmo           REAL    NOT NULL,
        cmi           REAL    NOT NULL,
        cmt           REAL    NOT NULL,
        cmaa          REAL    NULL
      );
    `;

    function buildDbConSchemaBase3(): import('node:sqlite').DatabaseSync {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
      const db = new DatabaseSync(':memory:');
      db.exec(SQL_SCHEMA_PARAMETROS_BASE_3);
      return db;
    }

    it('T-CMAA-0: la constante MIGRACION_030_PARAMETROS_APLICA_CMAA existe en migraciones.ts', () => {
      // RED puro: la constante NO existe en el codigo de produccion
      // todavia. Este test falla hasta que la task 2.2 GREEN la cree.
      // Leemos el source del archivo migraciones.ts y verificamos que
      // el nombre aparece al menos una vez.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path') as typeof import('path');
      const ruta = path.join(__dirname, '..', 'migraciones.ts');
      const source = fs.readFileSync(ruta, 'utf8');
      expect(source).toMatch(/MIGRACION_030_PARAMETROS_APLICA_CMAA/);
    });

    it('T-CMAA-1: round-trip aplica_cmaa=true con cmaa > 0 persiste ambos valores', () => {
      const db = buildDbConSchemaBase3();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { aplicarMigrationAditivaIdempotenteNode } = require('../../../../dominio/persistencia/sqlite/migraciones-idempotente');
        aplicarMigrationAditivaIdempotenteNode(db, SQL_MIGRACION_030_APLICA_CMAA);

        // PRAGMA table_info confirma la nueva columna con NOT NULL + CHECK.
        const cols = db.prepare("PRAGMA table_info(parametros_tarifa)").all() as Array<{
          name: string;
          type: string;
          notnull: 0 | 1;
          dflt_value: string | null;
        }>;
        const col = cols.find((c) => c.name === 'aplica_cmaa');
        expect(col).toBeDefined();
        expect(col!.type).toMatch(/INTEGER/i);
        expect(col!.notnull).toBe(1);
        // El default 0 lo aplica SQLite a filas existentes; las nuevas
        // pueden omitir el campo o setear 0/1.
        expect(col!.dflt_value).toBe('0');

        // INSERT con flag=true (1) y cmaa=5000 (CMAA explicito en pesos).
        db.prepare(
          `INSERT INTO parametros_tarifa
            (id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmaa, aplica_cmaa)
           VALUES (1, 7, 100, 2026, 12000000, 500, 200, 100, 5000, 1)`,
        ).run();

        const row = db.prepare(
          `SELECT aplica_cmaa, cmaa FROM parametros_tarifa WHERE id_parametros = 1`,
        ).get() as { aplica_cmaa: number; cmaa: number | null };
        expect(row.aplica_cmaa).toBe(1);
        expect(row.cmaa).toBe(5000);
      } finally {
        db.close();
      }
    });

    it('T-CMAA-2: round-trip aplica_cmaa=false con cmaa=0 (NO se computa CMAA)', () => {
      const db = buildDbConSchemaBase3();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { aplicarMigrationAditivaIdempotenteNode } = require('../../../../dominio/persistencia/sqlite/migraciones-idempotente');
        aplicarMigrationAditivaIdempotenteNode(db, SQL_MIGRACION_030_APLICA_CMAA);

        // INSERT con flag=false (0) y cmaa=0 (no hay inversiones ambientales).
        db.prepare(
          `INSERT INTO parametros_tarifa
            (id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmaa, aplica_cmaa)
           VALUES (2, 7, 100, 2026, 12000000, 500, 200, 100, 0, 0)`,
        ).run();

        const row = db.prepare(
          `SELECT aplica_cmaa, cmaa FROM parametros_tarifa WHERE id_parametros = 2`,
        ).get() as { aplica_cmaa: number; cmaa: number | null };
        expect(row.aplica_cmaa).toBe(0);
        expect(row.cmaa).toBe(0);
      } finally {
        db.close();
      }
    });

    it('T-CMAA-3: aplica_cmaa=true con cmaa=null persiste OK (legacy data con flag activado pero sin valor)', () => {
      const db = buildDbConSchemaBase3();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { aplicarMigrationAditivaIdempotenteNode } = require('../../../../dominio/persistencia/sqlite/migraciones-idempotente');
        aplicarMigrationAditivaIdempotenteNode(db, SQL_MIGRACION_030_APLICA_CMAA);

        // Legacy: el admin activo el flag (aplica_cmaa=1) pero todavia
        // no definio un valor monetario (cmaa=NULL). El motor usa 0
        // como fallback defensivo — la carga del form mostrara 0 y el
        // admin podra editarlo despues. La migration debe aceptar este
        // caso (no rompe el CHECK).
        db.prepare(
          `INSERT INTO parametros_tarifa
            (id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmaa, aplica_cmaa)
           VALUES (3, 7, 100, 2026, 12000000, 500, 200, 100, NULL, 1)`,
        ).run();

        const row = db.prepare(
          `SELECT aplica_cmaa, cmaa FROM parametros_tarifa WHERE id_parametros = 3`,
        ).get() as { aplica_cmaa: number; cmaa: number | null };
        expect(row.aplica_cmaa).toBe(1);
        expect(row.cmaa).toBeNull();
      } finally {
        db.close();
      }
    });
  });
});
