import { crearConexion } from '../db';
import { transaccion } from '../transaccion';

describe('transaccion (helper)', () => {
  it('hace commit y devuelve el resultado de fn cuando no lanza', () => {
    const db = crearConexion();
    try {
      db.exec('CREATE TABLE marcador (valor INTEGER)');

      const resultado = transaccion(db, () => {
        db.prepare('INSERT INTO marcador (valor) VALUES (?)').run(7);
        return 'ok';
      });

      expect(resultado).toBe('ok');
      const fila = db.prepare('SELECT valor FROM marcador').get() as { valor: number };
      expect(fila.valor).toBe(7);
    } finally {
      db.close();
    }
  });

  it('hace rollback y re-lanza el error original cuando fn lanza', () => {
    const db = crearConexion();
    try {
      db.exec('CREATE TABLE marcador (valor INTEGER)');
      const errorOriginal = new Error('fallo deliberado');

      expect(() =>
        transaccion(db, () => {
          db.prepare('INSERT INTO marcador (valor) VALUES (?)').run(99);
          throw errorOriginal;
        }),
      ).toThrow(errorOriginal);

      const filas = db.prepare('SELECT valor FROM marcador').all();
      expect(filas).toEqual([]);
      expect(db.inTransaction).toBe(false);
    } finally {
      db.close();
    }
  });
});
