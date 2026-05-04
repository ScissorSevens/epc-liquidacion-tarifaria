/**
 * Tests del bootstrap `crearBootstrapLecturaSqlite`.
 *
 * Cablea adapter SQLite real contra archivos temporales en `os.tmpdir()`
 * para verificar el lifecycle completo (open -> migrate -> use -> close).
 *
 * Espejo intencional de `src/factura/__tests__/bootstrap.test.ts`.
 */

import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { crearBootstrapLecturaSqlite } from '../bootstrap-lectura';
import { lecturaBase } from '../../__tests__/lectura-repository-contract';

function crearDirTmp(): string {
  return mkdtempSync(join(tmpdir(), 'epc-bootstrap-lectura-'));
}

describe('crearBootstrapLecturaSqlite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = crearDirTmp();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('crea archivo SQLite en dbPath nuevo, aplica migraciones y devuelve repository funcional (smoke)', async () => {
    const dbPath = join(tmpDir, 'lectura.db');
    expect(existsSync(dbPath)).toBe(false);

    const bootstrap = crearBootstrapLecturaSqlite({ dbPath });
    try {
      // 1. archivo creado
      expect(existsSync(dbPath)).toBe(true);

      // 2. migraciones aplicadas -> tabla lectura existe
      const inspector = new Database(dbPath, { readonly: true });
      try {
        const version = inspector.pragma('user_version', { simple: true }) as number;
        expect(version).toBeGreaterThanOrEqual(2);
        const tabla = inspector
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lectura'")
          .get();
        expect(tabla).toEqual({ name: 'lectura' });
      } finally {
        inspector.close();
      }

      // 3. repository expuesto y funcional: round-trip guardar -> obtener
      expect(typeof bootstrap.repository.guardar).toBe('function');
      expect(typeof bootstrap.cerrar).toBe('function');

      const guardada = await bootstrap.repository.guardar(lecturaBase());
      expect(guardada.id_lectura).toBeGreaterThan(0);

      const recuperada = await bootstrap.repository.obtenerPorId(guardada.id_lectura!);
      expect(recuperada).toEqual(guardada);
    } finally {
      bootstrap.cerrar();
    }
  });
});
