/**
 * Tests del bootstrap `crearBootstrapColaSqlite`.
 *
 * Cablea adapter SQLite real contra archivos temporales para validar
 * el lifecycle (open -> migrate -> use -> close) y la persistencia
 * round-trip que resuelve la BOMBA OFFLINE-FIRST #1: la cola sobrevive
 * a cierres del proceso.
 *
 * Espejo de `bootstrap-lectura.test.ts` y `bootstrap.test.ts` (factura).
 */

import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { crearBootstrapColaSqlite } from '../bootstrap-cola';
import { itemBase } from '../../../sincronizacion/__tests__/cola-repository.contract';

function crearDirTmp(): string {
  return mkdtempSync(join(tmpdir(), 'epc-bootstrap-cola-'));
}

describe('crearBootstrapColaSqlite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = crearDirTmp();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('crea archivo SQLite en dbPath nuevo, aplica migraciones y devuelve repository funcional (smoke)', async () => {
    const dbPath = join(tmpDir, 'cola.db');
    expect(existsSync(dbPath)).toBe(false);

    const bootstrap = crearBootstrapColaSqlite({ dbPath });
    try {
      // 1. archivo creado
      expect(existsSync(dbPath)).toBe(true);

      // 2. migraciones aplicadas → tabla cola_sincronizacion existe
      const inspector = new Database(dbPath, { readonly: true });
      try {
        const version = inspector.pragma('user_version', { simple: true }) as number;
        expect(version).toBeGreaterThanOrEqual(3);
        const tabla = inspector
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='cola_sincronizacion'",
          )
          .get();
        expect(tabla).toEqual({ name: 'cola_sincronizacion' });
      } finally {
        inspector.close();
      }

      // 3. repository expuesto y funcional: round-trip guardar -> buscar
      expect(typeof bootstrap.repository.guardar).toBe('function');
      expect(typeof bootstrap.cerrar).toBe('function');

      const item = itemBase();
      await bootstrap.repository.guardar(item);
      const recuperado = await bootstrap.repository.buscarPorId(item.id);
      expect(recuperado).not.toBeNull();
      expect(recuperado!.id).toBe(item.id);
    } finally {
      bootstrap.cerrar();
    }
  });
});
