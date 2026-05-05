/**
 * Tests del adapter SQLite de `SuscriptorRepository`.
 *
 * Espejo del patron de `lectura-repository-sqlite.ts`. Usa el fixture
 * `crearDBTest` para tener una DB en memoria con todas las migrations
 * (incluyendo 004) ya aplicadas.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { crearDBTest } from '../__fixtures__/crear-db-test';
import { crearSuscriptorRepositorySqlite } from '../suscriptor-repository-sqlite';
import type { SuscriptorBorrador } from '../../../suscriptores';

function suscriptorBase(overrides: Partial<SuscriptorBorrador> = {}): SuscriptorBorrador {
  return {
    codigo: '0005',
    nombre_apellidos: 'Juan Perez',
    direccion: 'Calle Falsa 123',
    estrato: 3,
    estado: 'activo',
    ...overrides,
  };
}

describe('crearSuscriptorRepositorySqlite', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = crearDBTest();
  });

  afterEach(() => {
    db.close();
  });

  it('crear() persiste el suscriptor y lo devuelve con id_suscriptor y created_at', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    const guardado = await repo.crear(suscriptorBase());

    expect(guardado.id_suscriptor).toBeGreaterThan(0);
    expect(typeof guardado.created_at).toBe('string');
    expect(guardado.codigo).toBe('0005');
    expect(guardado.nombre_apellidos).toBe('Juan Perez');
    expect(guardado.estrato).toBe(3);
    expect(guardado.estado).toBe('activo');
  });

  it('buscarPorId() devuelve el suscriptor persistido', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    const guardado = await repo.crear(suscriptorBase());
    const recuperado = await repo.buscarPorId(guardado.id_suscriptor);
    expect(recuperado).toEqual(guardado);
  });

  it('buscarPorId() devuelve null si el id no existe', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    expect(await repo.buscarPorId(9999)).toBeNull();
  });

  it('buscarPorCodigo() devuelve el suscriptor cuando existe (hit)', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    const guardado = await repo.crear(suscriptorBase({ codigo: '0042' }));
    const recuperado = await repo.buscarPorCodigo('0042');
    expect(recuperado).toEqual(guardado);
  });

  it('buscarPorCodigo() devuelve null cuando no existe (miss)', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    expect(await repo.buscarPorCodigo('9999')).toBeNull();
  });
});
