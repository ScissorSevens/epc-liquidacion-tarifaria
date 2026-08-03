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

  it('re-abrir el mismo dbPath NO re-ejecuta migraciones (idempotencia)', () => {
    const dbPath = join(tmpDir, 'lectura.db');

    // Primer bootstrap: aplica migraciones desde cero
    const primero = crearBootstrapLecturaSqlite({ dbPath });
    let versionPrimero: number;
    try {
      const inspector = new Database(dbPath, { readonly: true });
      try {
        versionPrimero = inspector.pragma('user_version', { simple: true }) as number;
      } finally {
        inspector.close();
      }
      expect(versionPrimero).toBeGreaterThanOrEqual(2);
    } finally {
      primero.cerrar();
    }

    // Segundo bootstrap sobre el MISMO archivo: si re-ejecutara las
    // migraciones, `CREATE TABLE lectura` lanzaria "table lectura already
    // exists". El runner debe filtrar por `user_version` y no lanzar.
    const segundo = crearBootstrapLecturaSqlite({ dbPath });
    try {
      const inspector = new Database(dbPath, { readonly: true });
      try {
        const versionSegundo = inspector.pragma('user_version', { simple: true }) as number;
        expect(versionSegundo).toBe(versionPrimero);
      } finally {
        inspector.close();
      }
      expect(typeof segundo.repository.guardar).toBe('function');
    } finally {
      segundo.cerrar();
    }
  });

  it('cerrar() libera la conexion: operaciones posteriores fallan', async () => {
    const dbPath = join(tmpDir, 'lectura.db');
    const bootstrap = crearBootstrapLecturaSqlite({ dbPath });

    // listar funciona ANTES de cerrar (conexion abierta)
    await expect(bootstrap.repository.listar()).resolves.toEqual([]);

    bootstrap.cerrar();

    // listar DESPUES de cerrar debe fallar: better-sqlite3 lanza
    // "The database connection is not open" al usar statements preparados
    // sobre una db cerrada.
    await expect(bootstrap.repository.listar()).rejects.toThrow(
      /database connection is not open/i,
    );
  });

  it('lanza error de dominio claro en espaniol cuando dbPath es invalido', () => {
    // Path con directorio padre inexistente -> SQLite no puede abrir el archivo
    const dbPathInvalido = join(tmpDir, 'subdir-inexistente', 'no', 'lectura.db');

    expect(() => crearBootstrapLecturaSqlite({ dbPath: dbPathInvalido })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/no se pudo abrir la base de datos/i),
        cause: expect.objectContaining({
          codigo: 'ERROR_PERSISTENCIA',
          dbPath: dbPathInvalido,
        }),
      }),
    );
  });

  it('end-to-end: guardar -> cerrar -> reabrir -> buscar funciona sobre archivo real', async () => {
    const dbPath = join(tmpDir, 'lectura-e2e.db');

    // Sesion 1: guardar lectura
    const sesion1 = crearBootstrapLecturaSqlite({ dbPath });
    let idGuardado: number;
    try {
      const guardada = await sesion1.repository.guardar(lecturaBase());
      idGuardado = guardada.id_lectura!;
      expect(idGuardado).toBeGreaterThan(0);
    } finally {
      sesion1.cerrar();
    }

    // Sesion 2: reabrir el mismo archivo y recuperar
    const sesion2 = crearBootstrapLecturaSqlite({ dbPath });
    try {
      const recuperada = await sesion2.repository.obtenerPorId(idGuardado);
      expect(recuperada).not.toBeNull();
      expect(recuperada!.id_lectura).toBe(idGuardado);
      expect(recuperada!.id_medidor).toBe(lecturaBase().id_medidor);
      expect(recuperada!.id_periodo).toBe(lecturaBase().id_periodo);

      const todas = await sesion2.repository.listar();
      expect(todas).toHaveLength(1);
    } finally {
      sesion2.cerrar();
    }
  });
});
