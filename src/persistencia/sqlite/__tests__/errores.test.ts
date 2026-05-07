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
      // No usamos toBeInstanceOf(Database.SqliteError) porque better-sqlite3 puede
      // ser instanciado dos veces (módulo duplicado) y la comparación de clase falla.
      expect(errorNativo).toBeTruthy();
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

  it('NOT NULL constraint → cause.codigo CAMPO_REQUERIDO', () => {
    const db = crearConexion();
    try {
      db.exec('CREATE TABLE _nn (a INTEGER NOT NULL)');

      let errorNativo: unknown;
      try {
        db.prepare('INSERT INTO _nn (a) VALUES (?)').run(null);
      } catch (e) {
        errorNativo = e;
      }
      expect((errorNativo as { code: string }).code).toBe('SQLITE_CONSTRAINT_NOTNULL');

      const mapeado = mapearErrorSqlite(errorNativo);
      expect(mapeado.cause.codigo).toBe('CAMPO_REQUERIDO');
      expect(mapeado.cause.sqliteCode).toBe('SQLITE_CONSTRAINT_NOTNULL');
    } finally {
      db.close();
    }
  });

  it('otro CONSTRAINT (FK) → cause.codigo RESTRICCION_INTEGRIDAD (catch-all de constraints)', () => {
    const db = crearConexion();
    try {
      db.exec('CREATE TABLE padre (id INTEGER PRIMARY KEY)');
      db.exec('CREATE TABLE hijo (id INTEGER, padre_id INTEGER REFERENCES padre(id))');

      let errorNativo: unknown;
      try {
        db.prepare('INSERT INTO hijo (id, padre_id) VALUES (?, ?)').run(1, 999);
      } catch (e) {
        errorNativo = e;
      }
      expect((errorNativo as { code: string }).code).toBe('SQLITE_CONSTRAINT_FOREIGNKEY');

      const mapeado = mapearErrorSqlite(errorNativo);
      expect(mapeado.cause.codigo).toBe('RESTRICCION_INTEGRIDAD');
      expect(mapeado.cause.sqliteCode).toBe('SQLITE_CONSTRAINT_FOREIGNKEY');
    } finally {
      db.close();
    }
  });

  it('CHECK constraint que NO es sobre estado/factura → RESTRICCION_INTEGRIDAD (no TRANSICION_ILEGAL)', () => {
    const db = crearConexion();
    try {
      db.exec('CREATE TABLE _c (n INTEGER CHECK (n > 0))');

      let errorNativo: unknown;
      try {
        db.prepare('INSERT INTO _c (n) VALUES (?)').run(-1);
      } catch (e) {
        errorNativo = e;
      }
      expect((errorNativo as { code: string }).code).toBe('SQLITE_CONSTRAINT_CHECK');

      // sin ctx.tabla=factura → debe caer en RESTRICCION_INTEGRIDAD
      const mapeado = mapearErrorSqlite(errorNativo);
      expect(mapeado.cause.codigo).toBe('RESTRICCION_INTEGRIDAD');
    } finally {
      db.close();
    }
  });

  it('error no-SQLite (no tiene .code) → cause.codigo ERROR_PERSISTENCIA con sqliteCode UNKNOWN', () => {
    const errorRaro = new Error('algo se rompió en otro lado');
    const mapeado = mapearErrorSqlite(errorRaro);
    expect(mapeado.cause.codigo).toBe('ERROR_PERSISTENCIA');
    expect(mapeado.cause.sqliteCode).toBe('UNKNOWN');
  });
});
