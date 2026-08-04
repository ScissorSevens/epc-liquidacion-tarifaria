/**
 * E2E: reproduce el bug "El prestador 0 no tiene ParametrosTarifa vigentes".
 *
 * CONTEXTO DEL BUG
 *
 * El usuario reporta que despues de hard reset + SetupInicial + AltaSuscriptor,
 * CapturarLectura muestra "El prestador 0 no tiene ParametrosTarifa vigentes".
 *
 * Root cause: dos defectos cooperan:
 *
 *   BUG #1 — `AltaSuscriptor.tsx:298` hardcodea `id_prestador: 0` al
 *            construir el SuscriptorBorrador via `crearSuscriptor()`. NO
 *            consulta `useWorkspace.id_prestador_activo`.
 *
 *   BUG #2 — `suscriptor-repository-expo-sqlite.ts:84-90` SQL_INSERT no
 *            incluye la columna `id_prestador`. El DEFAULT 0 de la
 *            migration 012 (`ALTER TABLE suscriptor ADD COLUMN id_prestador
 *            INTEGER NOT NULL DEFAULT 0`) siempre pisa cualquier valor que
 *            venga en el borrador. El adapter Node espejado
 *            (`dominio/persistencia/sqlite/suscriptor-repository-sqlite.ts:78-88`)
 *            SI incluye la columna — copy-paste drift entre adapters.
 *
 * Resultado observable: cada suscriptor persistido tiene `id_prestador = 0`,
 * que es el placeholder EPC-LEGACY sembrado por la migration 009. Cuando
 * CapturarLectura carga el suscriptor y consulta
 * `resolverContextoPrestador(s.id_prestador)`, resuelve al prestador
 * legacy (existe!) pero con `parametros: null` porque EPC-LEGACY no tiene
 * parametros_tarifa. El check de CapturarLectura.tsx:331-337 muestra el
 * snack "El prestador {suscriptor.id_prestador} no tiene ParametrosTarifa
 * vigentes".
 *
 * Este test E2E ejercita el path COMPLETO desde bootstrap hasta el read del
 * suscriptor via el adapter expo-sqlite real (no mockeado), contra una DB
 * SQLite real en memoria (better-sqlite3). Asi atrapamos ambos defectos:
 *
 *   1. El suscriptor se persiste con el `id_prestador` correcto (cubre BUG #2).
 *   2. CapturarLectura puede resolver el contexto multi-tenant sin tropezar
 *      con `parametros === null` (cubre BUG #1 + BUG #2 en conjunto).
 *
 * TDD evidence:
 *   RED:   antes del fix, `crear()` devuelve el suscriptor con id_prestador=0
 *          (porque el INSERT no incluye la columna y el DEFAULT pisa el valor).
 *          `resolverContextoPrestador(0)` devuelve `parametros: null`.
 *   GREEN: despues del fix, el suscriptor persistido tiene el id_prestador
 *          correcto del workspace, y `parametros` resuelve no-null.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Adapter `expo-sqlite` → `better-sqlite3` (sync wrapped to async).
 * Replica el contrato minimo que necesita el codigo de produccion:
 * `execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`,
 * `withTransactionAsync`, `closeAsync`. Mismo patron que
 * `bootstrap-handleFinalizar-e2e.test.ts`.
 */
interface ExpoLikeDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

function createExpoLikeDb(rawDb: Database.Database): ExpoLikeDb {
  return {
    async execAsync(sql: string): Promise<void> {
      rawDb.exec(sql);
    },
    async runAsync(
      sql: string,
      ...params: unknown[]
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      const stmt = rawDb.prepare(sql);
      const result = stmt.run(...(params as unknown[]));
      return {
        lastInsertRowId: Number(
          (result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0,
        ),
        changes: result.changes,
      };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...(params as unknown[])) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      const stmt = rawDb.prepare(sql);
      const row = stmt.get(...(params as unknown[]));
      return (row ?? null) as T | null;
    },
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      rawDb.exec('BEGIN');
      try {
        await task();
        rawDb.exec('COMMIT');
      } catch (err) {
        try {
          rawDb.exec('ROLLBACK');
        } catch {
          /* swallow rollback error */
        }
        throw err;
      }
    },
    async closeAsync(): Promise<void> {
      rawDb.close();
    },
  };
}

/**
 * Carga las migrations reales via require aislado con mock de expo-sqlite.
 * Replica el patron de bootstrap-handleFinalizar-e2e.test.ts.
 */
async function cargarMigraciones(expoDb: ExpoLikeDb): Promise<void> {
  const archivoMigraciones = path.resolve(
    __dirname,
    '../../persistencia/expo-sqlite/migraciones.ts',
  );
  expect(fs.existsSync(archivoMigraciones)).toBe(true);

  await new Promise<void>((resolve, reject) => {
    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../persistencia/expo-sqlite/migraciones');
        mod.aplicarMigracionesAsync(expoDb).then(resolve, reject);
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}

interface PrestadorRow {
  readonly id_prestador: number;
  readonly codigo: string;
  readonly nombre: string;
}

interface SuscriptorRow {
  readonly id_suscriptor: number;
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly id_prestador: number;
}

interface ParametrosRow {
  readonly id_prestador: number;
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
}

describe('E2E suscriptor.id_prestador no queda en 0 (regression: "El prestador 0 no tiene ParametrosTarifa vigentes")', () => {
  let db: Database.Database;
  let expoDb: ExpoLikeDb;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    expoDb = createExpoLikeDb(db);
    await cargarMigraciones(expoDb);
  }, 30_000);

  afterEach(() => {
    db.close();
  });

  it('REGRESION-1: SQL_INSERT del adapter expo-sqlite incluye id_prestador (no cae al DEFAULT 0)', async () => {
    // Cargamos el adapter expo-sqlite REAL (no mockeado) via jest.isolateModules
    // para que use nuestro expoDb sobre better-sqlite3.
    let repo:
      | {
          crear: (data: unknown) => Promise<unknown>;
        }
      | undefined;

    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../persistencia/expo-sqlite/suscriptor-repository-expo-sqlite');
      repo = mod.crearSuscriptorRepositoryExpoSqlite(expoDb);
    });
    expect(repo).toBeDefined();

    // Insertamos el prestador via SQL directo (mimic bootstrap) — id_prestador=1
    db.prepare(
      `INSERT INTO prestador (id_prestador, codigo, nombre, nit, municipio, departamento, segmento, estado)
       VALUES (1, '0001', 'Asociacion La Esperanza', '900123456-7', 'Caqueza', 'Cundinamarca', 2, 'activo')`,
    ).run();

    // Creamos un suscriptor con id_prestador=1 (lo que AltaSusCRIPTOR DEBE pasar
    // despues del fix; antes del fix hardcodeaba 0).
    const borrador = {
      codigo: '0001',
      nombre_apellidos: 'Juan Perez',
      cedula: '123456789',
      municipio: 'Caqueza',
      direccion: 'Calle Falsa 123',
      estrato: 3,
      matricula_inmobiliaria: undefined,
      numero_catastral: undefined,
      aplica_subsidio: false,
      estado: 'activo',
      id_prestador: 1, // <-- el fix: AltaSuscriptor deberia pasar este valor
      categoria_uso: 'residencial',
    };

    const creado = (await repo!.crear(borrador)) as SuscriptorRow;

    // El adapter debe DEVOLVER el id_prestador correcto (leido via SELECT).
    expect(creado.id_prestador).toBe(1);

    // Y la fila en la DB debe tener id_prestador=1 (NO 0).
    const fila = db
      .prepare('SELECT id_prestador FROM suscriptor WHERE id_suscriptor = ?')
      .get(creado.id_suscriptor) as { id_prestador: number } | undefined;
    expect(fila).toBeDefined();
    expect(fila!.id_prestador).toBe(1);
  });

  it('REGRESION-2: full path — suscriptor persistido con id_prestador del workspace tiene contexto multi-tenant resoluble', async () => {
    // Cargamos los adapters que necesitamos.
    let suscriptorRepo:
      | {
          crear: (data: unknown) => Promise<SuscriptorRow>;
          buscarPorId: (id: number) => Promise<SuscriptorRow | null>;
        }
      | undefined;
    let prestadorRepo:
      | {
          crear: (data: unknown) => Promise<PrestadorRow>;
          obtenerPorId: (id: number) => Promise<PrestadorRow | null>;
        }
      | undefined;
    let parametrosRepo:
      | {
          crear: (data: unknown) => Promise<unknown>;
          buscarVigente: (id: number, fecha: string) => Promise<unknown>;
        }
      | undefined;

    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sMod = require('../../persistencia/expo-sqlite/suscriptor-repository-expo-sqlite');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pMod = require('../../persistencia/expo-sqlite/prestador-repository-expo-sqlite');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ptMod = require('../../persistencia/expo-sqlite/parametros-tarifa-repository-expo-sqlite');
      suscriptorRepo = sMod.crearSuscriptorRepositoryExpoSqlite(expoDb);
      prestadorRepo = pMod.crearPrestadorRepositoryExpoSqlite(expoDb);
      parametrosRepo = ptMod.crearParametrosTarifaRepositoryExpoSqlite(expoDb);
    });

    expect(suscriptorRepo).toBeDefined();
    expect(prestadorRepo).toBeDefined();
    expect(parametrosRepo).toBeDefined();

    // ── 1. Bootstrap: crear prestador + acuerdo + parametros (mimic bootstrapCompleto)
    const prestador = await prestadorRepo!.crear({
      codigo: '0001',
      nombre: 'Asociacion La Esperanza',
      nit: '900123456-7',
      representante_legal: 'Juan Perez',
      representante_legal_cedula: '1234567890',
      municipio: 'Caqueza',
      departamento: 'Cundinamarca',
      segmento: 2,
      num_suscriptores_urbanos: 0,
      num_suscriptores_rurales: 150,
      email: 'contacto@laesperanza.co',
      telefono: '3112223344',
      contacto: null,
      estado: 'activo',
      aps: null,
    });
    expect(prestador.id_prestador).toBeGreaterThan(0);

    // Acuerdo + parametros via SQL directo (no necesitamos el adapter para estos
    // — solo necesitamos que la FK parametros_tarifa.id_prestador apunte al
    // prestador real).
    const acuerdoId = Number(
      (
        db
          .prepare(
            `INSERT INTO acuerdo_municipal (id_prestador, factor_subsidio_e1, factor_subsidio_e2, factor_subsidio_e3, factor_contribucion_e5, factor_contribucion_e6, factor_contribucion_comercial, factor_contribucion_industrial, fecha_vigencia_desde, fecha_vigencia_hasta, acto_administrativo_url, observaciones)
             VALUES (?, 0, 0, 0, 0, 0, 0, 0, '2026-01-01', '2031-12-31', NULL, 'test')`,
          )
          .run(prestador.id_prestador) as { lastInsertRowid: number | bigint }
      ).lastInsertRowid,
    );

    await parametrosRepo!.crear({
      id_prestador: prestador.id_prestador,
      id_acuerdo: acuerdoId,
      periodo: 2026,
      cma: 5_000_000,
      cmo: 800,
      cmi: 200,
      cmt: 100,
      cmviaa: 0,
      aplica_cmviaa: false,
      agua_suministrada_m3_anio: 12_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 150,
      aplica_minimo_vital: false,
      m3_gratis_minimo_vital: 0,
      ipuf_indice: 1.0,
      componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT'],
      minimo_vital: null,
      anio_base: 2016,
      factor_indexacion_ipc: 1.0,
      vigente_desde: '2026-01-01',
      vigente_hasta: '2031-12-31',
      cargo_fijo_resultante: 1234,
      cargo_consumo_resultante: 1100,
    });

    // ── 2. AltaSuscriptor: crear suscriptor con id_prestador del workspace
    const suscriptorCreado = await suscriptorRepo!.crear({
      codigo: '0001',
      nombre_apellidos: 'Maria Lopez',
      cedula: '987654321',
      municipio: 'Caqueza',
      direccion: 'Vereda El Centro',
      estrato: 2,
      matricula_inmobiliaria: undefined,
      numero_catastral: undefined,
      aplica_subsidio: true,
      estado: 'activo',
      id_prestador: prestador.id_prestador, // <-- el valor correcto del workspace
      categoria_uso: 'residencial',
    });

    expect(suscriptorCreado.id_prestador).toBe(prestador.id_prestador);

    // ── 3. CapturarLectura: leer suscriptor y resolver contexto
    const suscriptorLeido = await suscriptorRepo!.buscarPorId(suscriptorCreado.id_suscriptor);
    expect(suscriptorLeido).not.toBeNull();
    expect(suscriptorLeido!.id_prestador).toBe(prestador.id_prestador);
    expect(suscriptorLeido!.id_prestador).not.toBe(0); // <-- el bug

    // ── 4. resolverContextoPrestador — equivalente al flow de CapturarLectura
    const ctxPrestador = await prestadorRepo!.obtenerPorId(suscriptorLeido!.id_prestador);
    expect(ctxPrestador).not.toBeNull();
    const parametros = await parametrosRepo!.buscarVigente(
      suscriptorLeido!.id_prestador,
      new Date().toISOString(),
    );
    expect(parametros).not.toBeNull(); // <-- CapturarLectura.tsx:331-337 pasaria este check

    // ── 5. Verificacion final: el prestador del contexto NO es el EPC-LEGACY (id=0)
    expect(suscriptorLeido!.id_prestador).not.toBe(0);
  });

  it('REGRESION-3: regression guard — verifica el contenido textual del SQL_INSERT del adapter expo-sqlite', () => {
    // El adapter expo-sqlite debe incluir `id_prestador` en su SQL_INSERT
    // (igual que el adapter Node espejado). Si alguien elimina la columna
    // accidentalmente, este test FALLA antes de que el bug aparezca en
    // produccion.
    const archivo = path.resolve(
      __dirname,
      '../../persistencia/expo-sqlite/suscriptor-repository-expo-sqlite.ts',
    );
    const contenido = fs.readFileSync(archivo, 'utf-8');

    // Debe mencionar id_prestador en el INSERT
    const insertMatch = /INSERT INTO suscriptor\s*\(([^)]+)\)/i.exec(contenido);
    expect(insertMatch).not.toBeNull();
    const columnas = insertMatch![1]!;
    expect(columnas).toMatch(/id_prestador/);
    expect(columnas).toMatch(/categoria_uso/);
  });

  it('REGRESION-4: AltaSuscriptor.tsx lee id_prestador del workspace (no hardcoded 0)', () => {
    // Regression guard: el screen AltaSuscriptor debe pasar
    // `id_prestador: useWorkspace.getState().id_prestador_activo` al
    // `crearSuscriptor()` (NO hardcodear 0).
    const archivo = path.resolve(
      __dirname,
      '../../pantallas/AltaSuscriptor.tsx',
    );
    const contenido = fs.readFileSync(archivo, 'utf-8');

    // Debe usar el workspace para resolver el prestador
    expect(contenido).toMatch(/useWorkspace/);
    // Debe leer id_prestador_activo
    expect(contenido).toMatch(/id_prestador_activo/);
    // Y NO debe hardcodear 0
    expect(contenido).not.toMatch(/id_prestador:\s*0\s*,/);
  });
});
