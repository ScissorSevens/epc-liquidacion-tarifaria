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
});
