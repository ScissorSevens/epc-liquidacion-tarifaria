import Database from 'better-sqlite3';
import { crearConexion } from '../db';
import { mapearErrorSqlite } from '../errores';

describe('mapearErrorSqlite', () => {
  it('CHECK constraint sobre estado con ctx.tabla=factura → cause.codigo TRANSICION_ILEGAL', () => {
    const db = crearConexion();
    try {
      db.exec("CREATE TABLE factura_mock (estado TEXT CHECK (estado IN ('BORRADOR','EMITIDA','PAGADA','ANULADA')))");

      let errorNativo: unknown;
      try {
        db.prepare('INSERT INTO factura_mock (estado) VALUES (?)').run('OTRO');
      } catch (e) {
        errorNativo = e;
      }

      // sanity: el INSERT debió fallar
      expect(errorNativo).toBeInstanceOf(Database.SqliteError);
      expect((errorNativo as { code: string }).code).toBe('SQLITE_CONSTRAINT_CHECK');

      const mapeado = mapearErrorSqlite(errorNativo, { tabla: 'factura' });

      expect(mapeado).toBeInstanceOf(Error);
      expect(mapeado.cause).toBeDefined();
      expect(mapeado.cause.codigo).toBe('TRANSICION_ILEGAL');
      expect(mapeado.cause.sqliteCode).toBe('SQLITE_CONSTRAINT_CHECK');
      expect(mapeado.cause.ctx).toEqual({ tabla: 'factura' });
    } finally {
      db.close();
    }
  });

  it('UNIQUE constraint → cause.codigo RESTRICCION_UNICIDAD preservando sqliteCode', () => {
    const db = crearConexion();
    try {
      db.exec('CREATE TABLE _u (k TEXT UNIQUE)');
      db.prepare('INSERT INTO _u (k) VALUES (?)').run('x');

      let errorNativo: unknown;
      try {
        db.prepare('INSERT INTO _u (k) VALUES (?)').run('x');
      } catch (e) {
        errorNativo = e;
      }

      expect((errorNativo as { code: string }).code).toBe('SQLITE_CONSTRAINT_UNIQUE');

      const mapeado = mapearErrorSqlite(errorNativo, { tabla: 'factura' });
      expect(mapeado.cause.codigo).toBe('RESTRICCION_UNICIDAD');
      expect(mapeado.cause.sqliteCode).toBe('SQLITE_CONSTRAINT_UNIQUE');
      expect(mapeado.cause.ctx).toEqual({ tabla: 'factura' });
    } finally {
      db.close();
    }
  });
});
