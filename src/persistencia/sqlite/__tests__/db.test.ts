import { crearConexion } from '../db';

describe('crearConexion (driver SQLite)', () => {
  it('abre una conexión en memoria cuando no se pasa ruta', () => {
    const db = crearConexion();
    try {
      const fila = db.prepare('SELECT 1 AS uno').get() as { uno: number };
      expect(fila.uno).toBe(1);
    } finally {
      db.close();
    }
  });
});
