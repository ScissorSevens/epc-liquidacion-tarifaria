/**
 * Tests del bootstrap `crearBootstrapFacturaSqlite`.
 *
 * Cablea adapter SQLite real contra archivos temporales en `os.tmpdir()`
 * para verificar el lifecycle completo (open → migrate → use → close).
 */

import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { crearBootstrapFacturaSqlite } from '../bootstrap';

function crearDirTmp(): string {
  return mkdtempSync(join(tmpdir(), 'epc-bootstrap-'));
}

describe('crearBootstrapFacturaSqlite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = crearDirTmp();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('crea archivo SQLite en dbPath nuevo y aplica migraciones (smoke)', () => {
    const dbPath = join(tmpDir, 'factura.db');
    expect(existsSync(dbPath)).toBe(false);

    const bootstrap = crearBootstrapFacturaSqlite({ dbPath });
    try {
      // 1. archivo creado
      expect(existsSync(dbPath)).toBe(true);
      // 2. migraciones aplicadas → user_version > 0
      const inspector = new Database(dbPath, { readonly: true });
      try {
        const version = inspector.pragma('user_version', { simple: true }) as number;
        expect(version).toBeGreaterThanOrEqual(1);
        // 3. tabla factura existe
        const tabla = inspector
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='factura'")
          .get();
        expect(tabla).toEqual({ name: 'factura' });
      } finally {
        inspector.close();
      }
      // 4. repository expuesto
      expect(typeof bootstrap.repository.crear).toBe('function');
      expect(typeof bootstrap.cerrar).toBe('function');
    } finally {
      bootstrap.cerrar();
    }
  });
});
