import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('abre archivo en disco cuando se pasa una ruta concreta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sqlite-test-'));
    const ruta = join(dir, 'datos.db');
    const db = crearConexion(ruta);
    try {
      db.exec('CREATE TABLE marcador (id INTEGER PRIMARY KEY)');
      db.prepare('INSERT INTO marcador (id) VALUES (?)').run(42);
      expect(existsSync(ruta)).toBe(true);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('habilita foreign_keys = ON por default', () => {
    const db = crearConexion();
    try {
      const valor = db.pragma('foreign_keys', { simple: true });
      expect(valor).toBe(1);
    } finally {
      db.close();
    }
  });

  it('habilita journal_mode = WAL en conexión a archivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sqlite-test-'));
    const ruta = join(dir, 'datos.db');
    const db = crearConexion(ruta);
    try {
      const modo = db.pragma('journal_mode', { simple: true });
      expect(modo).toBe('wal');
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
