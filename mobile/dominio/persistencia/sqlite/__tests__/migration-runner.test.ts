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

  it('aplica migrations en orden ascendente por version aunque la lista venga desordenada', () => {
    const db = crearConexion();
    try {
      // v2 depende de v1: v2 hace ALTER de la tabla creada en v1.
      // Si se aplica fuera de orden, ALTER falla porque la tabla aún no existe.
      const migrations: Migration[] = [
        {
          version: 2,
          nombre: '002_alter',
          sql: 'ALTER TABLE marcador ADD COLUMN extra TEXT',
        },
        {
          version: 1,
          nombre: '001_create',
          sql: 'CREATE TABLE marcador (valor INTEGER NOT NULL)',
        },
      ];

      expect(() => ejecutarMigrations(db, migrations)).not.toThrow();
      expect(db.pragma('user_version', { simple: true })).toBe(2);

      // verificar que ambas columnas existen
      const cols = db.prepare("PRAGMA table_info('marcador')").all() as Array<{ name: string }>;
      const nombres = cols.map((c) => c.name);
      expect(nombres).toContain('valor');
      expect(nombres).toContain('extra');
    } finally {
      db.close();
    }
  });
});
