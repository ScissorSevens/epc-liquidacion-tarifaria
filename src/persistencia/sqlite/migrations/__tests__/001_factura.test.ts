import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';

describe('migration 001_factura — schema básico', () => {
  it('crea la tabla factura tras aplicar la migration y deja user_version=1', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(db.pragma('user_version', { simple: true })).toBe(1);

      const tabla = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='factura'")
        .get();
      expect(tabla).toBeDefined();
    } finally {
      db.close();
    }
  });
});
