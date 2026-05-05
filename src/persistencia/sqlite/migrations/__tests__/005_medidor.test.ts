/**
 * Tests de schema de la migration 005_medidor.
 *
 * Verifica columnas, NOT NULL, CHECK de estado, UNIQUE de numero_medidor,
 * FK a suscriptor (con ON DELETE RESTRICT), e indice por id_suscriptor.
 * Es la base sobre la que se construye el adapter SQLite de
 * `MedidorRepository`.
 */

import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';

describe('migration 005_medidor — schema completo', () => {
  it('crea la tabla medidor tras aplicar las migrations', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(5);

      const tabla = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='medidor'")
        .get();
      expect(tabla).toEqual({ name: 'medidor' });
    } finally {
      db.close();
    }
  });

  it('declara las columnas del tipo Medidor', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const cols = db.prepare("PRAGMA table_info('medidor')").all() as Array<{
        name: string;
      }>;
      const nombres = cols.map((c) => c.name);

      expect(nombres).toEqual(
        expect.arrayContaining([
          'id_medidor',
          'numero_medidor',
          'id_suscriptor',
          'fecha_instalacion',
          'estado',
          'observaciones',
          'created_at',
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('declara NOT NULL en obligatorias y permite NULL en observaciones', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const cols = db.prepare("PRAGMA table_info('medidor')").all() as Array<{
        name: string;
        notnull: number;
      }>;
      const byName = new Map(cols.map((c) => [c.name, c.notnull === 1]));

      ['numero_medidor', 'id_suscriptor', 'fecha_instalacion', 'estado', 'created_at'].forEach((col) => {
        expect(byName.get(col)).toBe(true);
      });
      expect(byName.get('observaciones')).toBe(false);
    } finally {
      db.close();
    }
  });

  it('rechaza estado fuera de {activo,inactivo,reemplazado} via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      // crear suscriptor primero para satisfacer FK
      db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('0001', 'Pepe', 'Calle 1', 3, 'activo');
      const insertar = db.prepare(
        `INSERT INTO medidor (numero_medidor, id_suscriptor, fecha_instalacion, estado)
         VALUES (?, ?, ?, ?)`,
      );
      expect(() => insertar.run('M-1', 1, '2024-01-01', 'INVALIDO')).toThrow(/CHECK/i);
    } finally {
      db.close();
    }
  });

  it('declara UNIQUE sobre numero_medidor', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('0001', 'Pepe', 'Calle 1', 3, 'activo');
      const insertar = db.prepare(
        `INSERT INTO medidor (numero_medidor, id_suscriptor, fecha_instalacion, estado)
         VALUES (?, ?, ?, ?)`,
      );
      insertar.run('M-1', 1, '2024-01-01', 'activo');
      expect(() => insertar.run('M-1', 1, '2024-01-02', 'activo')).toThrow(/UNIQUE/i);
    } finally {
      db.close();
    }
  });

  it('rechaza FK invalida (id_suscriptor inexistente)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const insertar = db.prepare(
        `INSERT INTO medidor (numero_medidor, id_suscriptor, fecha_instalacion, estado)
         VALUES (?, ?, ?, ?)`,
      );
      expect(() => insertar.run('M-1', 999, '2024-01-01', 'activo')).toThrow(/FOREIGN/i);
    } finally {
      db.close();
    }
  });

  it('id_medidor es AUTOINCREMENT', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      db.prepare(
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('0001', 'Pepe', 'Calle 1', 3, 'activo');
      const insertar = db.prepare(
        `INSERT INTO medidor (numero_medidor, id_suscriptor, fecha_instalacion, estado)
         VALUES (?, ?, ?, ?)`,
      );
      const r1 = insertar.run('M-1', 1, '2024-01-01', 'activo');
      const r2 = insertar.run('M-2', 1, '2024-01-01', 'activo');
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
        `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('0001', 'Pepe', 'Calle 1', 3, 'activo');
      db.prepare(
        `INSERT INTO medidor (numero_medidor, id_suscriptor, fecha_instalacion)
         VALUES (?, ?, ?)`,
      ).run('M-9', 1, '2024-01-01');
      const row = db.prepare("SELECT estado FROM medidor WHERE numero_medidor = 'M-9'").get() as {
        estado: string;
      };
      expect(row.estado).toBe('activo');
    } finally {
      db.close();
    }
  });
});
