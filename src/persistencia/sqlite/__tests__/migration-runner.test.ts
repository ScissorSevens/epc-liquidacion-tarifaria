import { crearConexion } from '../db';
import { ejecutarMigrations, type Migration } from '../migration-runner';

describe('ejecutarMigrations (runner)', () => {
  it('aplica migration v1 sobre DB vacía y deja user_version=1', () => {
    const db = crearConexion();
    try {
      const migrations: Migration[] = [
        {
          version: 1,
          nombre: '001_marcador',
          sql: 'CREATE TABLE marcador (valor INTEGER NOT NULL)',
        },
      ];

      ejecutarMigrations(db, migrations);

      const userVersion = db.pragma('user_version', { simple: true });
      expect(userVersion).toBe(1);

      const tabla = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='marcador'")
        .get();
      expect(tabla).toBeDefined();
    } finally {
      db.close();
    }
  });

  it('re-ejecutar la misma lista de migrations es no-op (idempotente)', () => {
    const db = crearConexion();
    try {
      const migrations: Migration[] = [
        {
          version: 1,
          nombre: '001_marcador',
          sql: 'CREATE TABLE marcador (valor INTEGER NOT NULL)',
        },
      ];

      ejecutarMigrations(db, migrations);
      // segunda corrida — si no hay idempotencia, "CREATE TABLE" lanza "table already exists"
      expect(() => ejecutarMigrations(db, migrations)).not.toThrow();

      const userVersion = db.pragma('user_version', { simple: true });
      expect(userVersion).toBe(1);
    } finally {
      db.close();
    }
  });

  it('si una migration falla, hace rollback y user_version queda en valor previo', () => {
    const db = crearConexion();
    try {
      // pre-aplicar v1 OK
      ejecutarMigrations(db, [
        { version: 1, nombre: '001_ok', sql: 'CREATE TABLE t1 (a INTEGER)' },
      ]);
      expect(db.pragma('user_version', { simple: true })).toBe(1);

      // intentar v2 con SQL inválido
      const migrationsConFallo: Migration[] = [
        { version: 2, nombre: '002_invalida', sql: 'CREATE TABLE t2 (a INTEGER); SELECT * FROM tabla_inexistente;' },
      ];

      expect(() => ejecutarMigrations(db, migrationsConFallo)).toThrow();

      // user_version no debe haber avanzado
      expect(db.pragma('user_version', { simple: true })).toBe(1);

      // t2 no debe existir (rollback)
      const t2 = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='t2'")
        .get();
      expect(t2).toBeUndefined();

      // DB no debe quedar con transacción abierta
      expect(db.inTransaction).toBe(false);
    } finally {
      db.close();
    }
  });
});
