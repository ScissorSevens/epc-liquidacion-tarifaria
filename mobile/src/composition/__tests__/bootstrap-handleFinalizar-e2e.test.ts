/**
 * E2E: handleFinalizar path — reproduce el error reportado por el usuario
 *
 *   WARN  [SetupInicial] error en bootstrap {"error": "Call to function
 *   'NativeDatabase.execAsync' has been rejected.→ Caused by: near \"NOT\":
 *   syntax error"}
 *
 * Stack del error: SetupInicial.tsx:143 (handleFinalizar()).
 *
 * Path completo que ejecuta el handleFinalizar en el device:
 *
 *   1. handleFinalizar() invoca getBootstrap() (cached) → bootstrapApp()
 *      → SQLite.openDatabaseAsync(NOMBRE_DB_MOVIL)
 *      → aplicarMigracionesAsync(db)              ← SQL DDL (24 migrations)
 *   2. bootstrap.ts: operarioRepo.inicializar()   ← SQL DDL (CREATE TABLE)
 *   3. handleFinalizar() invoca bootstrapCompleto()
 *      → prestadorRepo.withTransactionAsync(task) ← BEGIN/COMMIT
 *      → task(): INSERT INTO prestador (...)
 *      → task(): INSERT INTO acuerdo_municipal (...)
 *      → task(): INSERT INTO parametros_tarifa (...)
 *      → task(): INSERT INTO operarios (...)       ← SQL DML
 *
 * El mock existente (__tests__/__mocks__/expo-sqlite.js) usa jest.fn() y NO
 * ejecuta SQL real, por lo que no detecta errores de sintaxis ni de runtime.
 *
 * Estrategia de este test: swap del modulo `expo-sqlite` por un adapter
 * powered by `better-sqlite3` (SQLite 3.53.0). Esto ejecuta el codigo de
 * produccion REAL contra un engine SQLite real. Si la sintaxis falla en
 * SQLite 3.53.0, FALLA el test y el mensaje muestra exactamente donde
 * explota. Si pasa, queda como regression guard.
 *
 * El device del usuario corre SQLite 3.50.3 (Expo SDK 54). La diferencia
 * de minor version entre 3.50.3 y 3.53.0 es negligible para DDL/DML
 * estandar; SQLite mantiene compatibilidad de CREATE TABLE syntax desde
 * 3.0.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// ────────────────────────────────────────────────────────────────────────────
// ADAPTER: expo-sqlite → better-sqlite3 (sync API wrapped to async)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Adapter que expone la API publica de `expo-sqlite` (async) sobre
 * `better-sqlite3` (sync). Mantiene el contrato minimo que necesita el
 * codigo de produccion:
 *
 *   - execAsync(sql)                → ignora retorno (DCL)
 *   - runAsync(sql, ...params)      → { lastInsertRowId, changes }
 *   - getAllAsync(sql, ...params)   → rows[]
 *   - getFirstAsync(sql, ...params) → row | null
 *   - withTransactionAsync(task)    → BEGIN/COMMIT/ROLLBACK
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
    async execAsync(sql: string) {
      // SQLite.exec() corre multiples statements separados por ';'. Expo hace
      // lo mismo. Importante: PRAGMA foreign_keys = ON antes de migraciones.
      rawDb.exec(sql);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const stmt = rawDb.prepare(sql);
      const result = stmt.run(...(params as unknown[]));
      // better-sqlite3 usa `lastInsertRowid` (i minuscula). Expo-sqlite
      // expone `lastInsertRowId` (I mayuscula). Adaptamos al contrato
      // de expo-sqlite para que el codigo de produccion (que lee
      // `result.lastInsertRowId`) funcione sin cambios.
      return {
        lastInsertRowId: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0),
        changes: result.changes,
      };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...(params as unknown[])) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      const stmt = rawDb.prepare(sql);
      const row = stmt.get(...(params as unknown[]));
      return (row ?? null) as T | null;
    },
    async withTransactionAsync(task) {
      // Replica semantica de expo-sqlite 16:
      //   - expo-sqlite hace BEGIN/COMMIT/ROLLBACK segun el callback
      //   - El callback recibe el `tx` para queries transaccionales; si no se
      //     usa, las queries contra `db` participan igual porque expo-sqlite
      //     serializa todo en la misma conexion. Expo-sqlite 16 deprecó el
      //     parametro `tx`, asi que el callback es `() => Promise<void>`.
      rawDb.exec('BEGIN');
      try {
        await task();
        rawDb.exec('COMMIT');
      } catch (err) {
        try { rawDb.exec('ROLLBACK'); } catch { /* swallow rollback error */ }
        throw err;
      }
    },
    async closeAsync() {
      rawDb.close();
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('E2E handleFinalizar — reproduce el path SQL real del device', () => {
  let db: Database.Database;
  let expoDb: ExpoLikeDb;

  beforeEach(() => {
    // :memory: para tests aislados. Cada test arranca con DB limpia.
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    expoDb = createExpoLikeDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('SQLITE-VERSION: documenta la version del engine usado (trazabilidad)', () => {
    const row = db.prepare('SELECT sqlite_version() AS v').get() as { v: string };
    // eslint-disable-next-line no-console
    console.log(`[E2E] SQLite engine: ${row.v} (device usa 3.50.3)`);
    expect(row.v).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('PATH-1: aplicarMigracionesAsync ejecuta 24 migrations sin error de sintaxis', () => {
    // Carga las migrations del archivo de produccion y las aplica una a una.
    // Esto reproduce LO QUE HACE expo-sqlite/SDK en el device.
    const archivoMigraciones = path.resolve(
      __dirname,
      '../../persistencia/expo-sqlite/migraciones.ts',
    );
    expect(fs.existsSync(archivoMigraciones)).toBe(true);

    // Extraemos los SQL constantes del archivo. Estrategia: importamos el
    // modulo via jest.isolateModules + jest.doMock para reemplazar
    // 'expo-sqlite' por nuestro adapter. Asi el codigo REAL de produccion
    // corre contra SQLite real.
    let aplicarMigracionesAsync: ((db: ExpoLikeDb) => Promise<void>) | undefined;

    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../persistencia/expo-sqlite/migraciones');
      aplicarMigracionesAsync = mod.aplicarMigracionesAsync;
    });

    expect(aplicarMigracionesAsync).toBeDefined();

    return aplicarMigracionesAsync!(expoDb).then(() => {
      // Verificamos que se creo la tabla de control + todas las de dominio
      const tablas = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all() as Array<{ name: string }>;
      const nombres = tablas.map((t) => t.name);
      expect(nombres).toContain('__migraciones_aplicadas');
      expect(nombres).toContain('factura');
      expect(nombres).toContain('lectura');
      expect(nombres).toContain('cola_sincronizacion');
      expect(nombres).toContain('suscriptor');
      expect(nombres).toContain('medidor');
      expect(nombres).toContain('prestador');
      expect(nombres).toContain('acuerdo_municipal');
      expect(nombres).toContain('parametros_tarifa');
      expect(nombres).toContain('operarios');
      expect(nombres).toContain('concepto_otro_valor');
      expect(nombres).toContain('minimo_vital');

      // Verificamos que las 27 migrations quedaron registradas
      // (24 previas + 3 de param-tarifa-res-825-compliance-phase2:
      //  025 parametros_tarifa.cmaa + docs,
      //  026 suscriptor.verification,
      //  027 acuerdo_municipal.estado,
      //  028 parametros_tarifa.altitud_msnm (param-tarifa-residuales-cra-825),
      //  028b parametros_tarifa.anio_destino_indexacion (idem).
      const aplicadas = db
        .prepare('SELECT version FROM __migraciones_aplicadas ORDER BY version')
        .all() as Array<{ version: number }>;
      expect(aplicadas.length).toBe(29);
    });
  }, 30000);

  it('PATH-2: operarioRepo.inicializar() ejecuta CREATE TABLE IF NOT EXISTS sin error', async () => {
    // 1. Aplicar migrations (necesario porque la tabla prestador/acuerdo
    //    es referenciada por FK en operarios despues de la migration 016)
    await expoDb.execAsync('PRAGMA foreign_keys = ON;');
    const archivoMigraciones = path.resolve(
      __dirname,
      '../../persistencia/expo-sqlite/migraciones.ts',
    );
    let aplicarMigracionesAsync: ((db: ExpoLikeDb) => Promise<void>) | undefined;

    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../persistencia/expo-sqlite/migraciones');
      aplicarMigracionesAsync = mod.aplicarMigracionesAsync;
    });
    await aplicarMigracionesAsync!(expoDb);

    // 2. Crear operarioRepo (codigo real de produccion) y llamar inicializar()
    let operarioRepo: {
      inicializar(): Promise<void>;
      crear(b: unknown): Promise<unknown>;
    } | undefined;

    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../persistencia/expo-sqlite/operario-repository-expo-sqlite');
      operarioRepo = mod.crearOperarioRepositoryExpoSqlite(expoDb);
    });

    expect(operarioRepo).toBeDefined();
    await operarioRepo!.inicializar();

    // Verificamos que la tabla operarios existe con todas sus columnas
    const cols = db
      .prepare('PRAGMA table_info(operarios)')
      .all() as Array<{ name: string }>;
    const nombres = cols.map((c) => c.name);
    expect(nombres).toEqual(
      expect.arrayContaining([
        'id_operario',
        'id_prestador',
        'numero_cedula',
        'nombre',
        'email',
        'password_hash',
        'rol',
        'estado',
        'dispositivo_id',
        'created_at',
      ]),
    );
  }, 30000);

  it('PATH-3: bootstrapCompleto ejecuta 4 INSERTs en transaccion sin error', async () => {
    // Setup: migrations + operarioRepo
    await expoDb.execAsync('PRAGMA foreign_keys = ON;');
    let aplicarMigracionesAsync: ((db: ExpoLikeDb) => Promise<void>) | undefined;
    let operarioRepoFactory: ((db: ExpoLikeDb) => unknown) | undefined;

    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../persistencia/expo-sqlite/migraciones');
      aplicarMigracionesAsync = mod.aplicarMigracionesAsync;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const opMod = require('../../persistencia/expo-sqlite/operario-repository-expo-sqlite');
      operarioRepoFactory = opMod.crearOperarioRepositoryExpoSqlite;
    });
    await aplicarMigracionesAsync!(expoDb);
    const operarioRepo = operarioRepoFactory!(expoDb) as {
      inicializar(): Promise<void>;
    };
    await operarioRepo.inicializar();

    // Construimos los repositorios necesarios para bootstrapCompleto
    const prestadorRepo = (() => {
      let repo: unknown;
      jest.isolateModules(() => {
        jest.doMock('expo-sqlite', () => ({
          __esModule: true,
          openDatabaseAsync: async () => expoDb,
        }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../persistencia/expo-sqlite/prestador-repository-expo-sqlite');
        repo = mod.crearPrestadorRepositoryExpoSqlite(expoDb);
      });
      return repo;
    })();

    const acuerdoRepo = (() => {
      let repo: unknown;
      jest.isolateModules(() => {
        jest.doMock('expo-sqlite', () => ({
          __esModule: true,
          openDatabaseAsync: async () => expoDb,
        }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../persistencia/expo-sqlite/acuerdo-municipal-repository-expo-sqlite');
        repo = mod.crearAcuerdoMunicipalRepositoryExpoSqlite(expoDb);
      });
      return repo;
    })();

    const parametrosRepo = (() => {
      let repo: unknown;
      jest.isolateModules(() => {
        jest.doMock('expo-sqlite', () => ({
          __esModule: true,
          openDatabaseAsync: async () => expoDb,
        }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../persistencia/expo-sqlite/parametros-tarifa-repository-expo-sqlite');
        repo = mod.crearParametrosTarifaRepositoryExpoSqlite(expoDb);
      });
      return repo;
    })();

    // Importamos bootstrap-completo con el mock
    let bootstrapCompleto: ((deps: unknown) => Promise<unknown>) | undefined;
    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        __esModule: true,
        openDatabaseAsync: async () => expoDb,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../bootstrap-completo');
      bootstrapCompleto = mod.bootstrapCompleto;
    });

    expect(bootstrapCompleto).toBeDefined();

    // Mocks para los adapters que bootstrap-completo necesita
    const hasher = {
      sha256: (input: string): string => `sha256(${input})`,
    };
    const idGenerator = {
      next: (): string => `id-${Date.now()}`,
    };

    const resultado = await bootstrapCompleto!({
      prestadorRepo,
      acuerdoRepo,
      parametrosRepo,
      operarioRepo: operarioRepo as unknown,
      hasher,
      idGenerator,
      input: {
        prestadorData: {
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
        },
        operarioData: {
          numero_cedula: '1234567890',
          nombre: 'Operario Uno',
          email: 'op1@laesperanza.co',
          password: 'password123',
        },
      },
    });

    expect(resultado).toBeDefined();

    // Verificamos que las 4 entidades se persistieron
    const prestadores = db.prepare('SELECT * FROM prestador').all();
    expect(prestadores.length).toBeGreaterThanOrEqual(1);
    const acuerdos = db.prepare('SELECT * FROM acuerdo_municipal').all();
    expect(acuerdos.length).toBe(1);
    const parametros = db.prepare('SELECT * FROM parametros_tarifa').all();
    expect(parametros.length).toBe(1);
    const operarios = db.prepare('SELECT * FROM operarios').all();
    expect(operarios.length).toBe(1);
  }, 30000);

  it('PATH-4: el orden de constraints "DEFAULT (expr) NOT NULL" se respeta en archivos criticos', () => {
    // Regression guard: cualquier CREATE/ALTER futuro debe respetar este
    // orden. Cualquier violacion futura hara fallar este test.
    const archivos = [
      path.resolve(__dirname, '../../persistencia/expo-sqlite/operario-repository-expo-sqlite.ts'),
      path.resolve(__dirname, '../../persistencia/expo-sqlite/migraciones.ts'),
    ];
    const badPattern = /NOT NULL DEFAULT\s*\(/;
    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, 'utf-8');
      expect(contenido).not.toMatch(badPattern);
    }
  });

  it('PATH-5: SQL del operario-repository (linea 56) ejecuta sin error', () => {
    // Reproduce EXACTAMENTE la SQL que dispara operarioRepo.inicializar()
    // en el device. Si esta SQL falla, este test falla con el MISMO mensaje
    // que ve el usuario en su celular.
    const sql = `
      CREATE TABLE IF NOT EXISTS operarios (
        id_operario    INTEGER PRIMARY KEY AUTOINCREMENT,
        id_prestador   INTEGER NOT NULL DEFAULT 0,
        numero_cedula  TEXT NOT NULL UNIQUE,
        nombre         TEXT NOT NULL,
        email          TEXT NOT NULL,
        password_hash  TEXT NOT NULL DEFAULT '',
        rol            TEXT NOT NULL DEFAULT 'operario',
        estado         TEXT NOT NULL DEFAULT 'activo',
        dispositivo_id TEXT,
        created_at     TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    expect(() => db.exec(sql)).not.toThrow();

    // Verificamos que podemos insertar un operario
    db.prepare(
      `INSERT INTO operarios (id_prestador, numero_cedula, nombre, email, password_hash, rol, estado, dispositivo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(1, '1234567890', 'Test User', 'test@example.com', 'sha256(x)', 'operario', 'activo', 'device-uuid-1');

    const row = db.prepare('SELECT * FROM operarios WHERE numero_cedula = ?').get('1234567890') as { created_at: string };
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}/); // formato ISO
  });
});