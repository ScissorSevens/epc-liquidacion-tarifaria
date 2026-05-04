/**
 * Tests de schema de la migration 002_lectura.
 *
 * Verifica que el SQL declara columnas, constraints y indices que el
 * adapter SQLite (`crearLecturaRepositorySqlite`) y el dominio van a
 * apoyarse, en linea con el tipo `Lectura` de captura-lecturas/types.ts
 * y la interface `LecturaRepository`.
 */

import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';
import { crearDBTest } from '../../__fixtures__/crear-db-test';

describe('migration 002_lectura — schema completo', () => {
  it('crea la tabla lectura tras aplicar las migrations y deja user_version=2', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      // user_version es global del registry; con 003_cola_sync sumada queda en 3.
      // Lo critico aca es que la 002 creo la tabla `lectura`.
      expect(db.pragma('user_version', { simple: true })).toBe(3);

      const tabla = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lectura'")
        .get();
      expect(tabla).toBeDefined();
    } finally {
      db.close();
    }
  });

  it('declara las columnas del tipo Lectura (id_lectura, id_medidor, id_periodo, id_operario, lectura_actual, lectura_anterior, evidencia_foto_path, evidencia_foto_hash, estado_validacion, observaciones, timestamp_captura, timestamp_sync, estado_sync)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const cols = db.prepare("PRAGMA table_info('lectura')").all() as Array<{
        name: string;
      }>;
      const nombres = cols.map((c) => c.name);

      expect(nombres).toEqual(
        expect.arrayContaining([
          'id_lectura',
          'id_medidor',
          'id_periodo',
          'id_operario',
          'lectura_actual',
          'lectura_anterior',
          'evidencia_foto_path',
          'evidencia_foto_hash',
          'estado_validacion',
          'observaciones',
          'timestamp_captura',
          'timestamp_sync',
          'estado_sync',
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('declara NOT NULL en columnas obligatorias y permite NULL en evidencia/observaciones/timestamp_sync', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const cols = db.prepare("PRAGMA table_info('lectura')").all() as Array<{
        name: string;
        notnull: number;
      }>;
      const byName = new Map(cols.map((c) => [c.name, c.notnull === 1]));

      const obligatorias = [
        'id_medidor',
        'id_periodo',
        'id_operario',
        'lectura_actual',
        'lectura_anterior',
        'estado_validacion',
        'timestamp_captura',
        'estado_sync',
      ];
      obligatorias.forEach((col) => {
        expect(byName.get(col)).toBe(true);
      });

      ['evidencia_foto_path', 'evidencia_foto_hash', 'observaciones', 'timestamp_sync'].forEach(
        (col) => {
          expect(byName.get(col)).toBe(false);
        },
      );
    } finally {
      db.close();
    }
  });

  it('rechaza INSERT con estado_validacion fuera de {pendiente,validado,error} via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const insertarInvalido = () =>
        db
          .prepare(
            `INSERT INTO lectura
              (id_medidor, id_periodo, id_operario, lectura_actual, lectura_anterior,
               estado_validacion, timestamp_captura, estado_sync)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(1, '202504', 1, 100, 80, 'INVALIDO', '2026-04-20T10:00:00.000Z', 'pendiente');

      expect(insertarInvalido).toThrow(/CHECK/i);
    } finally {
      db.close();
    }
  });

  it('rechaza INSERT con estado_sync fuera de {pendiente,sincronizado,error} via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const insertarInvalido = () =>
        db
          .prepare(
            `INSERT INTO lectura
              (id_medidor, id_periodo, id_operario, lectura_actual, lectura_anterior,
               estado_validacion, timestamp_captura, estado_sync)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(1, '202504', 1, 100, 80, 'pendiente', '2026-04-20T10:00:00.000Z', 'INVALIDO');

      expect(insertarInvalido).toThrow(/CHECK/i);
    } finally {
      db.close();
    }
  });

  it('declara UNIQUE compuesta sobre (id_medidor, id_periodo)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const insertar = db.prepare(
        `INSERT INTO lectura
          (id_medidor, id_periodo, id_operario, lectura_actual, lectura_anterior,
           estado_validacion, timestamp_captura, estado_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      // Primer insert OK.
      insertar.run(1, '202504', 1, 100, 80, 'pendiente', '2026-04-20T10:00:00.000Z', 'pendiente');

      // Mismo medidor + mismo periodo → UNIQUE violado.
      expect(() =>
        insertar.run(1, '202504', 2, 110, 80, 'pendiente', '2026-04-20T11:00:00.000Z', 'pendiente'),
      ).toThrow(/UNIQUE/i);

      // Mismo medidor, distinto periodo → permitido.
      expect(() =>
        insertar.run(1, '202505', 1, 120, 100, 'pendiente', '2026-05-20T10:00:00.000Z', 'pendiente'),
      ).not.toThrow();

      // Distinto medidor, mismo periodo → permitido.
      expect(() =>
        insertar.run(2, '202504', 1, 200, 180, 'pendiente', '2026-04-20T10:00:00.000Z', 'pendiente'),
      ).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('id_lectura es AUTOINCREMENT: insert sin id_lectura asigna entero positivo creciente', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const insertar = db.prepare(
        `INSERT INTO lectura
          (id_medidor, id_periodo, id_operario, lectura_actual, lectura_anterior,
           estado_validacion, timestamp_captura, estado_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const r1 = insertar.run(1, '202504', 1, 100, 80, 'pendiente', '2026-04-20T10:00:00.000Z', 'pendiente');
      const r2 = insertar.run(2, '202504', 1, 200, 180, 'pendiente', '2026-04-20T10:00:00.000Z', 'pendiente');

      expect(Number(r1.lastInsertRowid)).toBe(1);
      expect(Number(r2.lastInsertRowid)).toBe(2);
    } finally {
      db.close();
    }
  });

  it('es idempotente: re-ejecutar las migrations no rompe ni cambia user_version', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      expect(db.pragma('user_version', { simple: true })).toBe(3);

      expect(() => ejecutarMigrations(db, migrations)).not.toThrow();
      expect(db.pragma('user_version', { simple: true })).toBe(3);
    } finally {
      db.close();
    }
  });

  it('crearDBTest devuelve una DB con la tabla lectura ya migrada (sanity check del fixture)', () => {
    const db = crearDBTest();
    try {
      expect(db.pragma('user_version', { simple: true })).toBe(3);
      const tabla = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lectura'")
        .get();
      expect(tabla).toBeDefined();
    } finally {
      db.close();
    }
  });
});
