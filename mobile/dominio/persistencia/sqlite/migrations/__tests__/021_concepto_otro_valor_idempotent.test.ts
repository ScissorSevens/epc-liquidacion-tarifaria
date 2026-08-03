/**
 * Tests de idempotencia de la migration 021_concepto_otro_valor.sql.
 *
 * El change `factura-compliance-hardening` introdujo la migration 021
 * que reemplaza la constante `OtrosValoresCatalogo` por una tabla SQLite
 * versionada. La migration usa `CREATE TABLE IF NOT EXISTS` +
 * `INSERT OR IGNORE` para garantizar idempotencia en re-ejecuciones
 * (instalaciones existentes, restauracion de backup, etc.).
 *
 * Verifica:
 *  - I-1: la primera ejecucion crea la tabla `concepto_otro_valor` con
 *    las 7 columnas correctas y siembra los 7 conceptos seed.
 *  - I-2: la segunda ejecucion (mismo script) NO falla — la migration
 *    es idempotente a nivel del schema.
 *  - I-3: re-ejecucion no duplica los 7 conceptos seed (`INSERT OR IGNORE`
 *    respeta la UNIQUE constraint sobre `codigo`).
 *  - I-4: el contador de filas es estable: ni crece ni decrece con N
 *    re-ejecuciones.
 *  - I-5: el script `021_concepto_otro_valor.sql` usa `CREATE TABLE IF NOT EXISTS`
 *    e `INSERT OR IGNORE` literalmente (verificacion de sintaxis).
 *
 * TDD: estos tests describen el contrato de idempotencia de la
 * migration 021. El change `factura-compliance-polish` endurezco esta
 * cobertura despues del verify-report warning #4 del change
 * `factura-compliance-hardening` (idempotencia solo testeada para 020,
 * no para 021).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';
import { CODIGOS_CONCEPTO_OTRO_VALOR } from '../../../../concepto-otro-valor/types';

const MIGRATION_DIR = join(__dirname, '..');

describe('migration 021_concepto_otro_valor — idempotencia', () => {
  it('I-1: primera ejecucion crea tabla `concepto_otro_valor` con 7 conceptos seed', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      // Tabla existe.
      const tabla = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='concepto_otro_valor'",
        )
        .get();
      expect(tabla).toEqual({ name: 'concepto_otro_valor' });

      // Las 7 columnas requeridas.
      const cols = db.prepare("PRAGMA table_info('concepto_otro_valor')").all() as Array<{
        name: string;
      }>;
      const nombres = cols.map((c) => c.name);
      expect(nombres).toEqual(
        expect.arrayContaining([
          'id_concepto',
          'codigo',
          'descripcion',
          'version',
          'activo',
          'requiere_glosa',
          'created_at',
        ]),
      );

      // Los 7 conceptos seed estan plantados.
      const rows = db
        .prepare('SELECT codigo FROM concepto_otro_valor ORDER BY id_concepto')
        .all() as Array<{ codigo: string }>;
      expect(rows).toHaveLength(CODIGOS_CONCEPTO_OTRO_VALOR.length);
      expect(rows.map((r) => r.codigo)).toEqual([...CODIGOS_CONCEPTO_OTRO_VALOR]);
    } finally {
      db.close();
    }
  });

  it('I-2: ejecutar la migration 021 dos veces NO falla (idempotente)', () => {
    const db = crearConexion();
    try {
      // Primera ejecucion: siembra los 7 conceptos.
      ejecutarMigrations(db, migrations);
      const antes = db
        .prepare('SELECT COUNT(*) as c FROM concepto_otro_valor')
        .get() as { c: number };
      expect(antes.c).toBe(7);

      // Segunda ejecucion: el `user_version` ya es 21, asi que el runner
      // filtra esta migration como "ya aplicada". Verificamos que el
      // runner no la re-ejecute (no-op).
      expect(() => ejecutarMigrations(db, migrations)).not.toThrow();

      const despues = db
        .prepare('SELECT COUNT(*) as c FROM concepto_otro_valor')
        .get() as { c: number };
      expect(despues.c).toBe(7);
    } finally {
      db.close();
    }
  });

  it('I-3: re-aplicar el SQL bruto de la migration 021 no duplica los seeds (INSERT OR IGNORE)', () => {
    const db = crearConexion();
    try {
      // Aplicamos las migrations 001..020 (necesarias para FK si las
      // hubiera; la 021 no depende de otras, asi que basta con crear
      // las tablas basicas).
      ejecutarMigrations(db, migrations);

      // Leemos el SQL de la migration 021 directamente.
      const sql = readFileSync(
        join(MIGRATION_DIR, '021_concepto_otro_valor.sql'),
        'utf-8',
      );

      // Aplicamos el SQL 2 veces (sin pasar por el runner). Esto
      // verifica la idempotencia intrinseca del SQL (CREATE TABLE IF NOT
      // EXISTS + INSERT OR IGNORE).
      db.exec(sql);
      expect(() => db.exec(sql)).not.toThrow();

      const rows = db
        .prepare('SELECT codigo FROM concepto_otro_valor ORDER BY id_concepto')
        .all() as Array<{ codigo: string }>;
      expect(rows).toHaveLength(7);
      expect(rows.map((r) => r.codigo)).toEqual([...CODIGOS_CONCEPTO_OTRO_VALOR]);
    } finally {
      db.close();
    }
  });

  it('I-4: 5 ejecuciones consecutivas del SQL bruto no incrementan ni decrementan el seed', () => {
    const db = crearConexion();
    try {
      // Para poder aplicar la 021 sin interference de las migrations
      // anteriores, creamos manualmente la tabla antes.
      const sql = readFileSync(
        join(MIGRATION_DIR, '021_concepto_otro_valor.sql'),
        'utf-8',
      );

      for (let i = 0; i < 5; i++) {
        db.exec(sql);
      }
      const rows = db
        .prepare('SELECT COUNT(*) as c FROM concepto_otro_valor')
        .get() as { c: number };
      expect(rows.c).toBe(7);
    } finally {
      db.close();
    }
  });

  it('I-5: el SQL 021 usa `CREATE TABLE IF NOT EXISTS` e `INSERT OR IGNORE` literalmente', () => {
    const sql = readFileSync(
      join(MIGRATION_DIR, '021_concepto_otro_valor.sql'),
      'utf-8',
    );
    // Garantia de diseno: la migration 021 declara explicitamente
    // idempotencia. Si alguien edita el SQL y elimina los keywords,
    // este test falla — la idempotencia es un contrato de la migration.
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+concepto_otro_valor/i);
    expect(sql).toMatch(/INSERT OR IGNORE INTO\s+concepto_otro_valor/i);
  });
});
