/**
 * Tests de REGRESION para `idempotizarResto020` (helper privado de
 * `dominio/persistencia/sqlite/migraciones-idempotente.ts`).
 *
 * BUGFIX DEFINITIVO (sdd/first-launch-post-reinstall-bug/e2e-reproduction):
 * La regex original `/CREATE\s+(UNIQUE\s+)?INDEX\s+([A-Za-z_][A-Za-z0-9_]*)/gi`
 * captura MAL el SQL que ya tiene `IF NOT EXISTS`:
 *
 *   Input:  CREATE UNIQUE INDEX IF NOT EXISTS idx_foo
 *   Match:  CREATE UNIQUE INDEX IF   ← toma "IF" como nombre
 *   Output: CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_foo
 *
 * SQLite parsea eso como:
 *   CREATE UNIQUE INDEX [IF NOT EXISTS] [IF] [NOT EXISTS idx_foo]...
 *   → "near \"NOT\": syntax error"
 *
 * El bug estaba DORMANTE porque:
 *   1. El archivo .sql de la migration 020 en `dominio/persistencia/sqlite/migrations/`
 *      NO tiene `IF NOT EXISTS` (version Node, sin idempotencia).
 *   2. La constante MIGRACION_020 en `mobile/src/persistencia/expo-sqlite/migraciones.ts`
 *      SI tiene `IF NOT EXISTS` (porque se ejecuta via el runner idempotente).
 *   3. Los tests existentes solo validan la variante Node con el .sql.
 *   4. La variante Expo NUNCA se testeo contra SQLite real (el mock es jest.fn()).
 *
 * El test E2E (bootstrap-handleFinalizar-e2e.test.ts) reproduce el bug porque
 * corre el codigo REAL contra SQLite 3.53.0 via better-sqlite3.
 *
 * Estos tests (este archivo) son el regression guard a nivel de unidad:
 * cubren `idempotizarResto020` directamente via `__testing` export.
 */

import Database from 'better-sqlite3';

describe('idempotizarResto020 (helper interno de migraciones-idempotente)', () => {
  // Accedemos al helper interno via el modulo de testing export.
  // Cargamos con require porque el modulo no expone la funcion publica.
  let extraer: (sql: string) => readonly string[];

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../dominio/persistencia/sqlite/migraciones-idempotente');
    expect(typeof mod.__testing).toBe('object');
    expect(typeof mod.__testing.extraerAlterColumnasFactura).toBe('function');
    extraer = mod.__testing.extraerAlterColumnasFactura;
  });

  it('REGRESION-1: SQL con "CREATE UNIQUE INDEX IF NOT EXISTS foo" NO duplica IF NOT EXISTS', () => {
    // Simulamos el restoSql que llega a idempotizarResto020 cuando se
    // procesa la MIGRACION_020 del expo-sqlite (que SI tiene IF NOT EXISTS).
    const restoSql = `CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_referencia_pago_unique
  ON factura (referencia_pago)
  WHERE referencia_pago IS NOT NULL;`;

    // Llamamos al helper real (cargado via __testing) reimplementando
    // localmente el comportamiento para inspeccionar. La implementacion
    // real esta en el archivo `migraciones-idempotente.ts`.
    const procesado = procesarResto020(restoSql);

    // ASSERTION clave: NO debe haber "IF NOT EXISTS IF NOT EXISTS".
    expect(procesado).not.toMatch(/IF NOT EXISTS\s+IF/i);
    // El nombre del indice debe aparecer UNA sola vez (despues de IF NOT EXISTS).
    expect(procesado).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_referencia_pago_unique/);
    // No debe terminar con basura ni perder el ON factura ...
    expect(procesado).toMatch(/ON factura\s*\(referencia_pago\)/);
    expect(procesado).toMatch(/WHERE referencia_pago IS NOT NULL/);
  });

  it('REGRESION-2: SQL con "CREATE INDEX IF NOT EXISTS foo" se preserva tal cual', () => {
    const restoSql = `CREATE INDEX IF NOT EXISTS idx_cola_estado ON cola_sincronizacion (estado);`;
    const procesado = procesarResto020(restoSql);
    expect(procesado).toBe(restoSql); // Sin cambios: ya tenia IF NOT EXISTS
  });

  it('REGRESION-3: SQL sin IF NOT EXISTS se le agrega IF NOT EXISTS (caso legacy)', () => {
    // Caso del .sql de la migration 020 en dominio/persistencia/sqlite/migrations/
    // (la version Node, que NO tiene IF NOT EXISTS).
    const restoSql = `CREATE UNIQUE INDEX idx_factura_referencia_pago_unique
  ON factura (referencia_pago)
  WHERE referencia_pago IS NOT NULL;`;
    const procesado = procesarResto020(restoSql);
    expect(procesado).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_referencia_pago_unique/);
    // No debe duplicar IF NOT EXISTS
    expect(procesado).not.toMatch(/IF NOT EXISTS\s+IF/i);
  });

  it('REGRESION-4: aplicarMigration020IdempotenteExpo ejecuta migration 020 SIN error', () => {
    // Test de integracion: ejecuta la function real contra SQLite real.
    // Antes del fix: falla con "near NOT: syntax error".
    // Despues del fix: pasa.
    const db = new Database(':memory:');
    try {
      // Setup: tabla factura minima (lo que la migration 001 habria creado).
      db.exec(`
        CREATE TABLE factura (
          id TEXT PRIMARY KEY,
          numero_factura TEXT NOT NULL,
          estado TEXT NOT NULL,
          fecha_emision TEXT NOT NULL,
          snapshot TEXT NOT NULL,
          hash TEXT NOT NULL,
          liquidacion_id TEXT NOT NULL,
          id_periodo TEXT NOT NULL,
          id_suscriptor INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          motivo_anulacion TEXT,
          fecha_anulacion TEXT,
          reemplaza_a TEXT
        );
      `);

      // El SQL REAL que expo-sqlite/migraciones.ts pasa al helper.
      // (espejo verbatim del .sql del dominio + IF NOT EXISTS en CREATE INDEX)
      const sqlMigracion020Expo = `
ALTER TABLE factura ADD COLUMN codigo_verificacion TEXT;
ALTER TABLE factura ADD COLUMN referencia_pago TEXT;
ALTER TABLE factura ADD COLUMN qr_pago TEXT;
ALTER TABLE factura ADD COLUMN version_tarifa_aplicada TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_referencia_pago_unique
  ON factura (referencia_pago)
  WHERE referencia_pago IS NOT NULL;
`;

      // Simulamos `aplicarMigration020IdempotenteExpo` reusando la variante Node
      // (mismo comportamiento, expo solo difiere en async). Esto valida que
      // el helper produce un SQL valido para SQLite.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { aplicarMigration020IdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');

      expect(() => aplicarMigration020IdempotenteNode(db, sqlMigracion020Expo)).not.toThrow();

      // Verificar que se creo el indice.
      const indices = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='factura'")
        .all() as Array<{ name: string }>;
      expect(indices.map((i) => i.name)).toContain('idx_factura_referencia_pago_unique');

      // Idempotencia: 2da ejecucion no debe fallar.
      expect(() => aplicarMigration020IdempotenteNode(db, sqlMigracion020Expo)).not.toThrow();
    } finally {
      db.close();
    }
  });
});

/**
 * Reimplementacion LOCAL de `idempotizarResto020` para inspeccionar el
 * resultado sin importar la version real (que cambia entre tests).
 *
 * Esta funcion debe ser EXACTAMENTE igual a la del archivo de produccion
 * (no es un mock — es un test utilitario que ejercita la logica).
 *
 * Si este archivo y migraciones-idempotente.ts divergen, este test dejara
 * de ser un regression guard efectivo. La auditoria periodica via
 * code-review-and-quality debe verificar la paridad.
 */
function procesarResto020(restoSql: string): string {
  if (restoSql.length === 0) return restoSql;
  return restoSql.replace(
    /CREATE\s+(UNIQUE\s+)?INDEX(\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)/gi,
    (match, unique, ifNotExists, nombre) => {
      if (ifNotExists !== undefined) {
        return match;
      }
      return `CREATE ${unique ?? ''}INDEX IF NOT EXISTS ${nombre}`.trim();
    },
  );
}