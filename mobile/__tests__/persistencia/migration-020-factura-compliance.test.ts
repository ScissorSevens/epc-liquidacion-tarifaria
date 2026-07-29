/**
 * Tests de la migration 020_factura_compliance_1038.sql.
 *
 * Verifica:
 *  - El archivo existe en el directorio correcto.
 *  - El SQL es valido (idempotente, sin syntax errors).
 *  - Las 4 columnas esperadas se crean tras ejecutar la migration.
 *  - Idempotencia: ejecutar 2 veces no falla.
 *  - El registro de la migration aparece en __migraciones_aplicadas.
 *  - Mirror en migraciones.ts de expo-sqlite existe.
 *
 * Usa sqlite3 in-memory (driver ligero) para validar el SQL.
 *
 * TDD: tests RED que validan la migration ANTES de que se cree el archivo.
 */
'use strict';

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

// Normalizar espacios multiples a uno solo para matching tolerante.
function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ');
}

const MIGRATION_DIR = join(__dirname, '..', '..', 'dominio', 'persistencia', 'sqlite', 'migrations');
const MIGRATION_INDEX = join(MIGRATION_DIR, 'index.ts');
const EXPO_MIGRACIONES = join(__dirname, '..', '..', 'src', 'persistencia', 'expo-sqlite', 'migraciones.ts');

describe('migration 020_factura_compliance_1038.sql', () => {
  it('archivo SQL existe en el directorio de migrations', () => {
    const path = join(MIGRATION_DIR, '020_factura_compliance_1038.sql');
    expect(existsSync(path)).toBe(true);
  });

  it('el archivo SQL tiene ALTER TABLE para las 4 columnas requeridas', () => {
    const path = join(MIGRATION_DIR, '020_factura_compliance_1038.sql');
    const sql = normalize(readFileSync(path, 'utf-8'));
    expect(sql).toMatch(/ALTER TABLE factura ADD COLUMN codigo_verificacion/i);
    expect(sql).toMatch(/ALTER TABLE factura ADD COLUMN referencia_pago/i);
    expect(sql).toMatch(/ALTER TABLE factura ADD COLUMN qr_pago/i);
    expect(sql).toMatch(/ALTER TABLE factura ADD COLUMN version_tarifa_aplicada/i);
  });

  it('migration 020 registrada en index.ts', () => {
    const idx = readFileSync(MIGRATION_INDEX, 'utf-8');
    expect(idx).toMatch(/version:\s*20\b/);
    expect(idx).toMatch(/020_factura_compliance_1038/);
  });

  it('migration 020 espejada en migraciones.ts de expo-sqlite', () => {
    const expo = normalize(readFileSync(EXPO_MIGRACIONES, 'utf-8'));
    expect(expo).toMatch(/MIGRACION_020_FACTURA_COMPLIANCE_1038/);
    expect(expo).toMatch(/ALTER TABLE factura ADD COLUMN codigo_verificacion/i);
  });

  it('la migration es ejecutable y agrega las 4 columnas a factura', () => {
    // Setup: una DB con la migration 001 aplicada (tabla factura).
    const db = new Database(':memory:');
    try {
      // Replicamos el CREATE TABLE de la migration 001 manualmente.
      db.exec(`
        CREATE TABLE factura (
          id               TEXT    PRIMARY KEY,
          numero_factura   TEXT    NOT NULL,
          estado           TEXT    NOT NULL CHECK (estado IN ('BORRADOR','EMITIDA','PAGADA','ANULADA')),
          fecha_emision    TEXT    NOT NULL,
          snapshot         TEXT    NOT NULL,
          hash             TEXT    NOT NULL,
          liquidacion_id   TEXT    NOT NULL,
          id_periodo       TEXT    NOT NULL,
          id_suscriptor    INTEGER NOT NULL,
          created_at       TEXT    NOT NULL,
          motivo_anulacion TEXT,
          fecha_anulacion  TEXT,
          reemplaza_a      TEXT
        );
        CREATE UNIQUE INDEX idx_factura_liquidacion_no_anulada
          ON factura (liquidacion_id) WHERE estado != 'ANULADA';
      `);

      // Aplicamos la migration 020.
      const sql = readFileSync(join(MIGRATION_DIR, '020_factura_compliance_1038.sql'), 'utf-8');
      db.exec(sql);

      // Validamos.
      const cols = db.prepare("PRAGMA table_info(factura)").all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);
      expect(names).toContain('codigo_verificacion');
      expect(names).toContain('referencia_pago');
      expect(names).toContain('qr_pago');
      expect(names).toContain('version_tarifa_aplicada');
    } finally {
      db.close();
    }
  });

  it('helper `aplicarMigration020Idempotente` ejecuta 2 veces sin error', () => {
    const db = new Database(':memory:');
    try {
      db.exec(`
        CREATE TABLE factura (
          id TEXT PRIMARY KEY, numero_factura TEXT, estado TEXT,
          fecha_emision TEXT, snapshot TEXT, hash TEXT,
          liquidacion_id TEXT, id_periodo TEXT, id_suscriptor INTEGER,
          created_at TEXT, motivo_anulacion TEXT, fecha_anulacion TEXT, reemplaza_a TEXT
        );
      `);
      const sql = readFileSync(join(MIGRATION_DIR, '020_factura_compliance_1038.sql'), 'utf-8');
      const { aplicarMigration020IdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');

      // Primera ejecución: aplica las 4 columnas.
      aplicarMigration020IdempotenteNode(db, sql);
      // Segunda ejecución: no debe lanzar error de "duplicate column"
      // porque el helper consulta `PRAGMA table_info` antes de cada ALTER.
      expect(() => aplicarMigration020IdempotenteNode(db, sql)).not.toThrow();

      const cols = db.prepare("PRAGMA table_info(factura)").all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);
      expect(names).toContain('codigo_verificacion');
      expect(names).toContain('referencia_pago');
      expect(names).toContain('qr_pago');
      expect(names).toContain('version_tarifa_aplicada');
    } finally {
      db.close();
    }
  });

  it('idempotencia: 5 ejecuciones consecutivas del helper no fallan ni duplican', () => {
    const db = new Database(':memory:');
    try {
      db.exec(`
        CREATE TABLE factura (
          id TEXT PRIMARY KEY, numero_factura TEXT, estado TEXT,
          fecha_emision TEXT, snapshot TEXT, hash TEXT,
          liquidacion_id TEXT, id_periodo TEXT, id_suscriptor INTEGER,
          created_at TEXT, motivo_anulacion TEXT, fecha_anulacion TEXT, reemplaza_a TEXT
        );
      `);
      const sql = readFileSync(join(MIGRATION_DIR, '020_factura_compliance_1038.sql'), 'utf-8');
      const { aplicarMigration020IdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');

      for (let i = 0; i < 5; i++) {
        aplicarMigration020IdempotenteNode(db, sql);
      }
      const cols = db.prepare("PRAGMA table_info(factura)").all() as Array<{ name: string }>;
      const codigoCount = cols.filter((c) => c.name === 'codigo_verificacion').length;
      expect(codigoCount).toBe(1);
    } finally {
      db.close();
    }
  });

  it('idempotencia: base parcialmente migrada solo agrega columnas faltantes', () => {
    const db = new Database(':memory:');
    try {
      db.exec(`
        CREATE TABLE factura (
          id TEXT PRIMARY KEY, numero_factura TEXT, estado TEXT,
          fecha_emision TEXT, snapshot TEXT, hash TEXT,
          liquidacion_id TEXT, id_periodo TEXT, id_suscriptor INTEGER,
          created_at TEXT, motivo_anulacion TEXT, fecha_anulacion TEXT, reemplaza_a TEXT
        );
        ALTER TABLE factura ADD COLUMN codigo_verificacion TEXT;
      `);
      const sql = readFileSync(join(MIGRATION_DIR, '020_factura_compliance_1038.sql'), 'utf-8');
      const { aplicarMigration020IdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');

      aplicarMigration020IdempotenteNode(db, sql);
      const cols = db.prepare("PRAGMA table_info(factura)").all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);
      expect(names).toContain('codigo_verificacion');
      expect(names).toContain('referencia_pago');
      expect(names).toContain('qr_pago');
      expect(names).toContain('version_tarifa_aplicada');
      const codigoCount = cols.filter((c) => c.name === 'codigo_verificacion').length;
      expect(codigoCount).toBe(1);
    } finally {
      db.close();
    }
  });

  it('la migration NO altera columnas existentes (solo ADD COLUMN)', () => {
    const sql = normalize(readFileSync(join(MIGRATION_DIR, '020_factura_compliance_1038.sql'), 'utf-8'));
    // No debe haber DROP COLUMN, ALTER COLUMN, RENAME, etc.
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/RENAME TO/i);
    expect(sql).not.toMatch(/RENAME COLUMN/i);
    // Solo ADD COLUMN.
    const adds = sql.match(/ALTER TABLE factura ADD COLUMN/gi) || [];
    expect(adds.length).toBeGreaterThanOrEqual(4);
  });
});
