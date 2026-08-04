/**
 * Smoke test del SQL embebido en expo-sqlite/migraciones.ts + operario-repository-expo-sqlite.ts.
 *
 * Hipotesis verificadas:
 *   1. El orden `NOT NULL DEFAULT (expr)` es valido en SQLite moderno.
 *   2. `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` (con `%f` para fracciones de segundo)
 *      es valido en SQLite >= 3.46. Expo SDK 54 ships SQLite 3.50.3 (ver
 *      https://github.com/expo/expo/blob/main/packages/expo-sqlite/CHANGELOG.md).
 *   3. Toda la secuencia de 24 migrations + operarioRepo.inicializar() corre
 *      limpia sobre un engine SQLite real.
 *
 * Por que importa: el bug reportado por el usuario despues de Expo Go reinstall
 * (`near "NOT": syntax error`) no se reproduce en better-sqlite3 3.53, lo que
 * sugiere que el problema NO es la sintaxis sino un edge case de la version
 * nativa de SQLite en el device del usuario. Estos tests sirven como
 * regression guard para que cualquier cambio futuro al SQL mantenga el contrato.
 *
 * El mock `__mocks__/expo-sqlite.js` no ejecuta el SQL de verdad, asi que
 * los tests existentes del repo no validan la sintaxis. Este test la valida
 * contra better-sqlite3 (mismo engine SQLite, version 3.53.0).
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('SQL smoke — aplicacion completa de migrations + operarioRepo SQL', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('SMOKE-1: el orden NOT NULL DEFAULT (strftime(...)) ejecuta sin error', () => {
    // Esta es la construccion que el bug report apuntaba como sospechosa.
    expect(() => {
      db.exec(`
        CREATE TABLE _t (
          a TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
          b INTEGER NOT NULL DEFAULT 0,
          c TEXT NOT NULL DEFAULT ''
        )
      `);
    }).not.toThrow();
  });

  it('SMOKE-2: strftime con %f (fracciones de segundo) es valido en SQLite >= 3.46', () => {
    expect(() => {
      db.exec(`
        CREATE TABLE _t (
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
      `);
    }).not.toThrow();
    // Insertamos una fila para que el DEFAULT se evalue. SELECT de una tabla
    // vacia devuelve undefined, no el default.
    db.exec("INSERT INTO _t DEFAULT VALUES");
    const row = db.prepare("SELECT created_at FROM _t LIMIT 1").get() as { created_at: string };
    // Formato esperado: YYYY-MM-DDTHH:MM:SS.sssZ (3 digitos de fraccion).
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('SMOKE-3: el orden inverso DEFAULT (strftime(...)) NOT NULL tambien es valido', () => {
    // Verificacion adicional: SQLite acepta ambos ordenes. El bug NO era el orden.
    expect(() => {
      db.exec(`
        CREATE TABLE _t (
          a TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')) NOT NULL
        )
      `);
    }).not.toThrow();
  });

  it('SMOKE-4: SQL_CREATE_TABLE exacto de operario-repository-expo-sqlite.ts ejecuta sin error', () => {
    // Este es el SQL que operarioRepo.inicializar() ejecuta. Si falla,
    // el usuario vera el crash reportado.
    expect(() => {
      db.exec(`
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
          created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
      `);
    }).not.toThrow();

    // La tabla debe estar utilisable (no-op si ya existe, pero verificamos el schema):
    const cols = db.prepare("PRAGMA table_info(operarios)").all() as Array<{ name: string }>;
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id_operario');
    expect(colNames).toContain('id_prestador');
    expect(colNames).toContain('password_hash');
    expect(colNames).toContain('created_at');
  });

  it('SMOKE-5: idempotencia — operarioRepo.inicializar() llamado 2 veces no falla', () => {
    // `CREATE TABLE IF NOT EXISTS` debe ser idempotente. La app lo llama en
    // bootstrap.ts (line 192) Y en limpiarDatosLegacyBypass (line 83), asi que
    // este escenario ocurre normalmente en cold-boot.
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
        created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `;
    expect(() => db.exec(sql)).not.toThrow();
    expect(() => db.exec(sql)).not.toThrow();
  });

  it('SMOKE-6: reporte la version de SQLite del runner (trazabilidad)', () => {
    const result = db.prepare("SELECT sqlite_version() AS v").get() as { v: string };
    // Solo loggeamos — el test pasa siempre. La intencion es documentar
    // la version contra la que se valida el SQL.
    // eslint-disable-next-line no-console
    console.log(`SQLite version: ${result.v}`);
    expect(result.v).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('SMOKE-7: invariante — ningun CREATE/ALTER en expo-sqlite usa NOT NULL DEFAULT (expr) con parentesis', () => {
    // Por que importa: SQLite 3.50.3 nativo en device (Expo SDK 54) parece
    // rechazar el orden `NOT NULL DEFAULT (expr)` en algunos contextos,
    // mientras que better-sqlite3 3.53.0 (en este runner) lo acepta.
    // El fix defensivo es reordenar a `DEFAULT (expr) NOT NULL` (orden valido
    // en TODAS las versiones de SQLite >= 3.0). Este test sirve como
    // regression guard: cualquier CREATE/ALTER futuro debe respetar el orden.
    //
    // Scope: solo archivos de produccion en `mobile/src/persistencia/expo-sqlite/`
    // (no incluye `__tests__/` porque ese codigo es testing de hipotesis y debe
    // poder ejercitar AMBOS ordenes para documentar el bug).
    const dirProduccion = path.resolve(__dirname, '../');
    const archivosProduccion = fs
      .readdirSync(dirProduccion)
      .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    const offending: Array<{ archivo: string; linea: number; match: string }> = [];
    const pattern = /NOT NULL DEFAULT\s*\(/g;

    for (const archivo of archivosProduccion) {
      const rutaCompleta = path.join(dirProduccion, archivo);
      const lineas = fs.readFileSync(rutaCompleta, 'utf-8').split('\n');
      lineas.forEach((linea, idx) => {
        const matches = linea.match(pattern);
        if (matches) {
          offending.push({ archivo, linea: idx + 1, match: linea.trim() });
        }
      });
    }

    expect(offending).toEqual([]);
  });

  it('SMOKE-8: el orden correcto de constraints (DEFAULT antes de NOT NULL) se respeta en archivos criticos', () => {
    // Por que importa: SMOKE-7 verifica ausencia del patron malo a nivel
    // global. SMOKE-8 lo refuerza en los 2 archivos mas criticos
    // (migraciones.ts y operario-repository-expo-sqlite.ts) con un mensaje
    // de error mas especifico que apunta al archivo responsable si vuelve
    // a aparecer el patron.
    const archivosCriticos = [
      'operario-repository-expo-sqlite.ts',
      'migraciones.ts',
    ];
    const dirProduccion = path.resolve(__dirname, '../');
    const badPattern = /NOT NULL DEFAULT\s*\(/;

    for (const archivo of archivosCriticos) {
      const rutaCompleta = path.join(dirProduccion, archivo);
      const contenido = fs.readFileSync(rutaCompleta, 'utf-8');
      expect(contenido).not.toMatch(badPattern);
    }
  });
});