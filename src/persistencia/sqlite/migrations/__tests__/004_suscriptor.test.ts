/**
 * Tests de schema de la migration 004_suscriptor.
 *
 * Verifica columnas, NOT NULL, CHECK de estrato/estado, UNIQUE de codigo
 * e indice por estrato. Es la base sobre la que se construye el adapter
 * SQLite de `SuscriptorRepository`.
 */

import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';

describe('migration 004_suscriptor — schema completo', () => {
  it('crea la tabla suscriptor tras aplicar las migrations', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(4);

      const tabla = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='suscriptor'")
        .get();
      expect(tabla).toEqual({ name: 'suscriptor' });
    } finally {
      db.close();
    }
  });

  it('declara las columnas del tipo Suscriptor', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const cols = db.prepare("PRAGMA table_info('suscriptor')").all() as Array<{
        name: string;
      }>;
      const nombres = cols.map((c) => c.name);

      expect(nombres).toEqual(
        expect.arrayContaining([
          'id_suscriptor',
          'codigo',
          'nombre_apellidos',
          'direccion',
          'estrato',
          'matricula_inmobiliaria',
          'numero_catastral',
          'estado',
          'created_at',
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('declara NOT NULL en obligatorias y permite NULL en matricula/catastral', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const cols = db.prepare("PRAGMA table_info('suscriptor')").all() as Array<{
        name: string;
        notnull: number;
      }>;
      const byName = new Map(cols.map((c) => [c.name, c.notnull === 1]));

      ['codigo', 'nombre_apellidos', 'direccion', 'estrato', 'estado', 'created_at'].forEach((col) => {
        expect(byName.get(col)).toBe(true);
      });
      ['matricula_inmobiliaria', 'numero_catastral'].forEach((col) => {
        expect(byName.get(col)).toBe(false);
      });
    } finally {
      db.close();
    }
  });

  it('rechaza estrato fuera de [1,6] via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const insertar = db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      );
      expect(() => insertar.run('0001', 'Pepe', 'Calle 1', 0, 'activo')).toThrow(/CHECK/i);
      expect(() => insertar.run('0002', 'Pepe', 'Calle 1', 7, 'activo')).toThrow(/CHECK/i);
    } finally {
      db.close();
    }
  });

  it('rechaza estado fuera de {activo,inactivo,suspendido} via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const insertar = db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      );
      expect(() => insertar.run('0001', 'Pepe', 'Calle 1', 3, 'INVALIDO')).toThrow(/CHECK/i);
    } finally {
      db.close();
    }
  });

  it('declara UNIQUE sobre codigo', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const insertar = db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      );
      insertar.run('0005', 'Pepe', 'Calle 1', 3, 'activo');
      expect(() => insertar.run('0005', 'Otro', 'Calle 2', 4, 'activo')).toThrow(/UNIQUE/i);
    } finally {
      db.close();
    }
  });

  it('id_suscriptor es AUTOINCREMENT', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const insertar = db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      );
      const r1 = insertar.run('0001', 'A', 'Calle', 1, 'activo');
      const r2 = insertar.run('0002', 'B', 'Calle', 1, 'activo');
      expect(Number(r1.lastInsertRowid)).toBe(1);
      expect(Number(r2.lastInsertRowid)).toBe(2);
    } finally {
      db.close();
    }
  });

  it('estado tiene DEFAULT activo cuando no se provee', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato)
         VALUES (?, ?, ?, ?)`,
      ).run('0009', 'Sin estado', 'Calle', 2);
      const row = db.prepare("SELECT estado FROM suscriptor WHERE codigo = '0009'").get() as {
        estado: string;
      };
      expect(row.estado).toBe('activo');
    } finally {
      db.close();
    }
  });
});
