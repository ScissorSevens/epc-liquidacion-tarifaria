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

  it('re-abrir el mismo dbPath NO re-ejecuta migraciones (idempotencia)', () => {
    const dbPath = join(tmpDir, 'cola.db');

    // Primer bootstrap: aplica migraciones desde cero
    const primero = crearBootstrapColaSqlite({ dbPath });
    let versionPrimero: number;
    try {
      const inspector = new Database(dbPath, { readonly: true });
      try {
        versionPrimero = inspector.pragma('user_version', { simple: true }) as number;
      } finally {
        inspector.close();
      }
      expect(versionPrimero).toBeGreaterThanOrEqual(3);
    } finally {
      primero.cerrar();
    }

    // Segundo bootstrap sobre el MISMO archivo: si re-ejecutara las
    // migraciones, `CREATE TABLE cola_sincronizacion` lanzaria
    // "already exists". El runner debe filtrar por `user_version`.
    const segundo = crearBootstrapColaSqlite({ dbPath });
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
    const dbPath = join(tmpDir, 'cola.db');
    const bootstrap = crearBootstrapColaSqlite({ dbPath });

    // listar funciona ANTES de cerrar
    await expect(bootstrap.repository.listar()).resolves.toEqual([]);

    bootstrap.cerrar();

    // listar DESPUES de cerrar debe fallar: better-sqlite3 lanza
    // "The database connection is not open" sobre statements preparados.
    await expect(bootstrap.repository.listar()).rejects.toThrow(
      /database connection is not open/i,
    );
  });

  it('lanza error de dominio claro en espaniol cuando dbPath es invalido', () => {
    // Path con directorio padre inexistente -> SQLite no puede abrir el archivo
    const dbPathInvalido = join(tmpDir, 'subdir-inexistente', 'no', 'cola.db');

    expect(() => crearBootstrapColaSqlite({ dbPath: dbPathInvalido })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/no se pudo abrir la base de datos/i),
        cause: expect.objectContaining({
          codigo: 'ERROR_PERSISTENCIA',
          dbPath: dbPathInvalido,
        }),
      }),
    );
  });

  it('BOMBA OFFLINE-FIRST #1: la cola sobrevive cierre del proceso (e2e reabrir archivo)', async () => {
    const dbPath = join(tmpDir, 'cola-e2e.db');

    // Sesion 1: encolar item PENDIENTE y "matar" el proceso
    const sesion1 = crearBootstrapColaSqlite({ dbPath });
    const item = itemBase({ id: 'sobreviviente-001' });
    try {
      await sesion1.repository.guardar(item);

      // Verificar que esta encolado en la sesion actual
      const pendientesAntes = await sesion1.repository.listarPendientes();
      expect(pendientesAntes).toHaveLength(1);
      expect(pendientesAntes[0].id).toBe('sobreviviente-001');
    } finally {
      sesion1.cerrar(); // <-- aca "muere" el proceso
    }

    // Sesion 2: reabrir el MISMO archivo y validar que el item sigue ahi
    const sesion2 = crearBootstrapColaSqlite({ dbPath });
    try {
      const recuperado = await sesion2.repository.buscarPorId('sobreviviente-001');
      expect(recuperado).not.toBeNull();
      expect(recuperado!.id).toBe('sobreviviente-001');
      expect(recuperado!.estado).toBe('PENDIENTE');
      expect(recuperado!.tipo).toBe(item.tipo);
      expect(recuperado!.hashLocal).toBe(item.hashLocal);
      expect(recuperado!.payload).toEqual(item.payload);

      // Y `listarPendientes` lo devuelve para que el procesador lo retome
      const pendientesDespues = await sesion2.repository.listarPendientes();
      expect(pendientesDespues).toHaveLength(1);
      expect(pendientesDespues[0].id).toBe('sobreviviente-001');
    } finally {
      sesion2.cerrar();
    }
  });
});
