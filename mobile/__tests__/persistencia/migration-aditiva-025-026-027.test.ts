/**
 * Tests del helper `aplicarMigrationAditivaIdempotente{Node,Expo}` para
 * migrations 025/026/027 (`param-tarifa-res-825-compliance-phase2`).
 *
 * Verifica:
 *  - El helper existe y exporta Node + Expo variants.
 *  - Primer pase: agrega todas las columnas con tipo+default preservados.
 *  - Segundo pase: idempotente (NO agrega columnas duplicadas).
 *  - Migracion parcial (algunas columnas pre-existen): solo agrega faltantes.
 *  - Funciona con multiples tablas en el mismo script (caso hipotetico futuro).
 *  - Preserva tipos no-string (REAL, INTEGER) y DEFAULTs no-string.
 *  - Si el script NO contiene ALTERs, ejecuta el script tal cual (fallback
 *    seguro para migrations futuras que no son puramente aditivas).
 *
 * Cambio F-READ-1 del verify-report del change archivado:
 * refactor para eliminar ~55 lineas de duplicacion entre migrations
 * 025/026/027 en `mobile/src/persistencia/expo-sqlite/migraciones.ts`.
 *
 * NOTA: las migrations 025/026/027 solo existen inline en `migraciones.ts`
 * (expo-sqlite side). El helper funciona con SQL arbitrario, asi que los
 * tests usan fixtures inline espejadas del source.
 *
 * TDD: estos tests son RED hasta que el helper exista.
 */
'use strict';

import { readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const EXPO_MIGRACIONES = join(__dirname, '..', '..', 'src', 'persistencia', 'expo-sqlite', 'migraciones.ts');
const HELPER_PATH = join(__dirname, '..', '..', 'dominio', 'persistencia', 'sqlite', 'migraciones-idempotente.ts');

// SQL fixtures inline (espejo verbatim de MIGRACION_025/026/027 en expo-sqlite/migraciones.ts).
const SQL_025 = `
ALTER TABLE parametros_tarifa ADD COLUMN cmaa REAL NULL;
ALTER TABLE parametros_tarifa ADD COLUMN acto_adopcion TEXT NULL;
ALTER TABLE parametros_tarifa ADD COLUMN estudio_costos_id TEXT NULL;
ALTER TABLE parametros_tarifa ADD COLUMN documento_soporte_url TEXT NULL;
`;

const SQL_026 = `
ALTER TABLE suscriptor ADD COLUMN estado_verificacion TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE suscriptor ADD COLUMN fuente_estrato TEXT NULL;
ALTER TABLE suscriptor ADD COLUMN fecha_verificacion_estrato TEXT NULL;
ALTER TABLE suscriptor ADD COLUMN soporte_estrato_url TEXT NULL;
`;

const SQL_027 = `
ALTER TABLE acuerdo_municipal ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO';
`;

describe('migration aditiva idempotente 025/026/027 (helper generico)', () => {
  it('helper existe y exporta variants Node + Expo', () => {
    // require lazy para que el test NO rompa si el helper no existe aun (TDD RED).
    const helper = require('../../dominio/persistencia/sqlite/migraciones-idempotente');
    expect(typeof helper.aplicarMigrationAditivaIdempotenteNode).toBe('function');
    expect(typeof helper.aplicarMigrationAditivaIdempotenteExpo).toBe('function');
  });

  it('primer pase: agrega todas las columnas con tipo+default preservados (025)', () => {
    const db = new Database(':memory:');
    try {
      // Setup: tabla pre-migration 025 (schema viejo, sin cmaa ni docs).
      db.exec(`
        CREATE TABLE parametros_tarifa (
          id_parametros INTEGER PRIMARY KEY,
          cma REAL NOT NULL
        );
      `);

      const { aplicarMigrationAditivaIdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');
      aplicarMigrationAditivaIdempotenteNode(db, SQL_025);

      const cols = db.prepare("PRAGMA table_info(parametros_tarifa)").all() as Array<{
        name: string;
        type: string;
        notnull: 0 | 1;
        dflt_value: string | null;
      }>;
      const byCol = new Map(cols.map((c) => [c.name, c]));

      // cmaa REAL NULL
      expect(byCol.get('cmaa')?.type).toMatch(/REAL/i);
      expect(byCol.get('cmaa')?.notnull).toBe(0);

      // acto_adopcion TEXT NULL
      expect(byCol.get('acto_adopcion')?.type).toMatch(/TEXT/i);
      expect(byCol.get('acto_adopcion')?.notnull).toBe(0);

      // estudio_costos_id TEXT NULL
      expect(byCol.get('estudio_costos_id')?.type).toMatch(/TEXT/i);

      // documento_soporte_url TEXT NULL
      expect(byCol.get('documento_soporte_url')?.type).toMatch(/TEXT/i);
    } finally {
      db.close();
    }
  });

  it('preserva DEFAULT y NOT NULL en columnas con default no-null (026)', () => {
    const db = new Database(':memory:');
    try {
      db.exec(`
        CREATE TABLE suscriptor (
          id_suscriptor INTEGER PRIMARY KEY,
          nombre TEXT NOT NULL
        );
      `);

      const { aplicarMigrationAditivaIdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');
      aplicarMigrationAditivaIdempotenteNode(db, SQL_026);

      const cols = db.prepare("PRAGMA table_info(suscriptor)").all() as Array<{
        name: string;
        notnull: 0 | 1;
        dflt_value: string | null;
      }>;
      const byCol = new Map(cols.map((c) => [c.name, c]));

      // estado_verificacion TEXT NOT NULL DEFAULT 'PENDIENTE'
      expect(byCol.get('estado_verificacion')?.notnull).toBe(1);
      expect(byCol.get('estado_verificacion')?.dflt_value).toMatch(/PENDIENTE/);

      // Los otros 3 son NULLable
      expect(byCol.get('fuente_estrato')?.notnull).toBe(0);
      expect(byCol.get('fecha_verificacion_estrato')?.notnull).toBe(0);
      expect(byCol.get('soporte_estrato_url')?.notnull).toBe(0);

      // Verificar DEFAULT aplica: insertar fila sin setear estado_verificacion
      db.exec(`INSERT INTO suscriptor (id_suscriptor, nombre) VALUES (1, 'Test')`);
      const row = db.prepare("SELECT estado_verificacion FROM suscriptor WHERE id_suscriptor = 1").get() as { estado_verificacion: string };
      expect(row.estado_verificacion).toBe('PENDIENTE');
    } finally {
      db.close();
    }
  });

  it('segundo pase: idempotente (NO agrega columnas duplicadas, 025+026+027)', () => {
    const db = new Database(':memory:');
    try {
      db.exec(`
        CREATE TABLE parametros_tarifa (id_parametros INTEGER PRIMARY KEY, cma REAL);
        CREATE TABLE suscriptor (id_suscriptor INTEGER PRIMARY KEY, nombre TEXT);
        CREATE TABLE acuerdo_municipal (id_acuerdo INTEGER PRIMARY KEY, fecha_inicio TEXT);
      `);

      const { aplicarMigrationAditivaIdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');

      // Primer pase: aplica todas
      aplicarMigrationAditivaIdempotenteNode(db, SQL_025);
      aplicarMigrationAditivaIdempotenteNode(db, SQL_026);
      aplicarMigrationAditivaIdempotenteNode(db, SQL_027);

      const colsAntes = db.prepare("PRAGMA table_info(parametros_tarifa)").all() as Array<{ name: string }>;
      const cantAntes = colsAntes.length;

      // Segundo pase: NO debe lanzar "duplicate column" ni agregar nada
      expect(() => aplicarMigrationAditivaIdempotenteNode(db, SQL_025)).not.toThrow();
      expect(() => aplicarMigrationAditivaIdempotenteNode(db, SQL_026)).not.toThrow();
      expect(() => aplicarMigrationAditivaIdempotenteNode(db, SQL_027)).not.toThrow();

      const colsDespues = db.prepare("PRAGMA table_info(parametros_tarifa)").all() as Array<{ name: string }>;
      expect(colsDespues.length).toBe(cantAntes); // misma cantidad de columnas

      // Verificar que no hay duplicados
      const nombres = colsDespues.map((c) => c.name);
      const unicos = new Set(nombres);
      expect(unicos.size).toBe(nombres.length);
    } finally {
      db.close();
    }
  });

  it('migracion parcial: solo agrega columnas faltantes', () => {
    const db = new Database(':memory:');
    try {
      // Pre-migrar parcialmente: cmaa ya existe, las otras 3 no.
      db.exec(`
        CREATE TABLE parametros_tarifa (
          id_parametros INTEGER PRIMARY KEY,
          cma REAL,
          cmaa REAL NULL  -- ya existe
        );
      `);

      const { aplicarMigrationAditivaIdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');
      aplicarMigrationAditivaIdempotenteNode(db, SQL_025);

      const cols = db.prepare("PRAGMA table_info(parametros_tarifa)").all() as Array<{ name: string }>;
      const nombres = cols.map((c) => c.name);
      expect(nombres).toContain('cmaa');
      expect(nombres).toContain('acto_adopcion');
      expect(nombres).toContain('estudio_costos_id');
      expect(nombres).toContain('documento_soporte_url');

      // Verificar que NO haya duplicado de cmaa
      const cmaaCount = cols.filter((c) => c.name === 'cmaa').length;
      expect(cmaaCount).toBe(1);
    } finally {
      db.close();
    }
  });

  it('multiples tablas en un mismo script (caso hipotetico para futures)', () => {
    // Simula un script que toca 2 tablas a la vez (NO es el caso real de
    // 025/026/027, pero prueba la robustez del helper para futuros cambios).
    const db = new Database(':memory:');
    try {
      db.exec(`
        CREATE TABLE t1 (id INTEGER PRIMARY KEY, a TEXT);
        CREATE TABLE t2 (id INTEGER PRIMARY KEY, x TEXT);
      `);
      const sql = `
ALTER TABLE t1 ADD COLUMN b TEXT;
ALTER TABLE t2 ADD COLUMN y INTEGER NOT NULL DEFAULT 0;
ALTER TABLE t1 ADD COLUMN c REAL;
`;
      const { aplicarMigrationAditivaIdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');
      aplicarMigrationAditivaIdempotenteNode(db, sql);

      const colsT1 = db.prepare("PRAGMA table_info(t1)").all() as Array<{ name: string }>;
      const colsT2 = db.prepare("PRAGMA table_info(t2)").all() as Array<{ name: string }>;
      expect(colsT1.map((c) => c.name)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
      expect(colsT2.map((c) => c.name)).toEqual(expect.arrayContaining(['x', 'y']));

      // y debe tener default 0
      db.exec(`INSERT INTO t2 (id) VALUES (1)`);
      const row = db.prepare("SELECT y FROM t2 WHERE id = 1").get() as { y: number };
      expect(row.y).toBe(0);
    } finally {
      db.close();
    }
  });

  it('script sin ALTERs: ejecuta fallback `db.exec(sql)` tal cual', () => {
    const db = new Database(':memory:');
    try {
      const sql = `CREATE TABLE solo_create (id INTEGER PRIMARY KEY);`;
      const { aplicarMigrationAditivaIdempotenteNode } = require('../../dominio/persistencia/sqlite/migraciones-idempotente');
      expect(() => aplicarMigrationAditivaIdempotenteNode(db, sql)).not.toThrow();
      const cols = db.prepare("PRAGMA table_info(solo_create)").all() as Array<{ name: string }>;
      expect(cols.map((c) => c.name)).toContain('id');
    } finally {
      db.close();
    }
  });

  it('expo-sqlite: el helper se invoca desde migraciones.ts sin duplicar logica inline', () => {
    // Regression guard: despues del refactor, la logica inline para 025/026/027
    // NO debe seguir en migraciones.ts — debe haber UNA llamada al helper.
    // El dispatch `if (version === 25 || ...)` SI puede quedar (es el dispatch
    // que selecciona el helper); lo que debe desaparecer es la logica interna
    // (PRAGMA + regex + ALTER).
    const expo = readFileSync(EXPO_MIGRACIONES, 'utf-8');

    // El helper debe estar importado
    expect(expo).toMatch(/aplicarMigrationAditivaIdempotenteExpo/);

    // 1. NO debe quedar el `PRAGMA table_info(${tabla})` inline con interpolacion
    //    (ahora encapsulado en el helper).
    expect(expo).not.toMatch(/PRAGMA\s+table_info\(\$\{tabla\}\)/);

    // 2. NO debe quedar el regex inline `ALTER\\s+TABLE\\s+${tabla}\\s+ADD\\s+COLUMN\\s+`
    //    con interpolacion de la variable `tabla`. El helper usa un regex similar
    //    pero en un modulo separado (migraciones-idempotente.ts).
    expect(expo).not.toMatch(/ALTER\\\\s\+TABLE\\\\s\+\$\{tabla\}/);

    // 3. El cuerpo del dispatch (entre `{` y `}`) debe invocar al helper.
    //    Cleanup A-1 (post-archive `param-tarifa-residuales-cra-825`):
    //    el dispatch ahora usa `migracion.kind === 'aditiva'` en lugar
    //    de la lista hardcoded de versiones (25 || 26 || ...). Verificamos
    //    el nuevo patron.
    const dispatchMatch = expo.match(
      /if\s*\(\s*migracion\.kind\s*===\s*['"]aditiva['"][\s\S]*?\n\s*\}\s*\n/,
    );
    expect(dispatchMatch).not.toBeNull();
    expect(dispatchMatch![0]).toMatch(/aplicarMigrationAditivaIdempotenteExpo/);
  });
});
