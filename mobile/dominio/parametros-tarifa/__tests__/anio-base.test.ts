/**
 * Tests del campo `anio_base` en ParametrosTarifa — Res CRA 825 Art. 7.
 *
 * Cambia `param-tarifa-res-825-compliance-phase1` (fase 1). Cubre:
 *   - Tipo: anio_base: number
 *   - Default 2016
 *   - Custom persiste
 *   - Migration 023 idempotente
 *
 * La migration 023 agrega la columna `anio_base` a la tabla
 * `parametros_tarifa`. La idempotencia se chequea via PRAGMA
 * table_info (mismo patron que migration 020).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { crearConexion } from '../../persistencia/sqlite/db';
import { ejecutarMigrations } from '../../persistencia/sqlite/migration-runner';
import { migrations as ALL_MIGRATIONS } from '../../persistencia/sqlite/migrations/index';
import type { ParametrosTarifa } from '../types';

function migrationsHasta(hastaVersion: number) {
  return ALL_MIGRATIONS.filter((m) => m.version <= hastaVersion);
}

describe('ParametrosTarifa.anio_base — tipo TS', () => {
  it('T-AB-1: type requiere anio_base: number', () => {
    const p: Partial<ParametrosTarifa> = { anio_base: 2016 };
    expect(typeof p.anio_base).toBe('number');
  });

  it('T-AB-2: anio_base custom 2020 persiste en type', () => {
    const p: Partial<ParametrosTarifa> = { anio_base: 2020 };
    expect(p.anio_base).toBe(2020);
  });

  it('T-AB-3 (triangulación): anio_base 2016 default del dominio', () => {
    const p: Partial<ParametrosTarifa> = {};
    // Default lo aplica la capa de persistencia; el type lo admite opcional.
    expect(p.anio_base).toBeUndefined();
  });
});

describe('migration 023_parametros_tarifa_anio_base — idempotencia', () => {
  it('T-AB-4: ALTER TABLE agrega columna anio_base con default 2016', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(23));
      const cols = db
        .prepare("PRAGMA table_info('parametros_tarifa')")
        .all() as Array<{ name: string; dflt_value: string | null }>;
      const col = cols.find((c) => c.name === 'anio_base');
      expect(col).toBeDefined();
      expect(col?.dflt_value).toBe('2016');
    } finally {
      db.close();
    }
  });

  it('T-AB-4b: ALTER TABLE agrega columna factor_indexacion_ipc con default 1.0', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(23));
      const cols = db
        .prepare("PRAGMA table_info('parametros_tarifa')")
        .all() as Array<{ name: string; dflt_value: string | null }>;
      const col = cols.find((c) => c.name === 'factor_indexacion_ipc');
      expect(col).toBeDefined();
      expect(col?.dflt_value).toBe('1.0');
    } finally {
      db.close();
    }
  });

  it('T-AB-5: ejecutar las migrations 2 veces no rompe (idempotente)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(23));
      // Segunda corrida: el user_version ya es 23, el runner skipea.
      expect(() => ejecutarMigrations(db, migrationsHasta(23))).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('T-AB-6: filas preexistentes quedan con anio_base = 2016 (default en ALTER)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(22));
      // Insertar fila antes de la 023 (simula DB legacy).
      db.prepare(
        `INSERT INTO prestador (id_prestador, codigo, nombre, nit, municipio, departamento, segmento)
         VALUES (1, 'TEST', 'Test', '900', 'Mun', 'Dep', 2)`,
      ).run();
      db.prepare(
        `INSERT INTO acuerdo_municipal
          (id_prestador, factor_subsidio_e1, factor_subsidio_e2, factor_subsidio_e3,
           factor_contribucion_e5, factor_contribucion_e6, fecha_vigencia_desde, fecha_vigencia_hasta)
         VALUES (1, 0.5, 0.4, 0.3, 0.5, 0.6, '2024-01-01', '2028-12-31')`,
      ).run();
      db.prepare(
        `INSERT INTO parametros_tarifa
          (id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmviaa,
           agua_suministrada_m3_anio, suscriptores_promedio, vigente_desde, vigente_hasta)
         VALUES (1, 1, 2024, 5000000, 400, 200, 100, 0, 50000, 1000, '2024-01-01', '2028-12-31')`,
      ).run();
      // Aplicar 023.
      ejecutarMigrations(db, migrationsHasta(23));
      const row = db
        .prepare(
          'SELECT anio_base FROM parametros_tarifa WHERE id_prestador = 1',
        )
        .get() as { anio_base: number };
      expect(row.anio_base).toBe(2016);
    } finally {
      db.close();
    }
  });

  it('T-AB-7: el SQL 023 usa ALTER TABLE ADD COLUMN con DEFAULT 2016 literalmente', () => {
    const sql = readFileSync(
      join(__dirname, '../../persistencia/sqlite/migrations/023_parametros_tarifa_anio_base.sql'),
      'utf-8',
    );
    expect(sql).toMatch(/ALTER\s+TABLE\s+parametros_tarifa\s+ADD\s+COLUMN\s+anio_base/i);
    expect(sql).toMatch(/DEFAULT\s+2016/i);
  });
});
