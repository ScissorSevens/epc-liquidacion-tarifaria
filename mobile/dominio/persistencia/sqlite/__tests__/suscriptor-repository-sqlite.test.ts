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
    cedula: '123456789',
    municipio: 'Bogota',
    direccion: 'Calle Falsa 123',
    estrato: 3,
    aplica_subsidio: false,
    estado: 'activo',
    id_prestador: 0,
    categoria_uso: 'residencial',
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

  it('existePorCodigo() devuelve true si el codigo existe', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    await repo.crear(suscriptorBase({ codigo: '0007' }));
    expect(await repo.existePorCodigo('0007')).toBe(true);
  });

  it('existePorCodigo() devuelve false si el codigo no existe', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    expect(await repo.existePorCodigo('9999')).toBe(false);
  });

  it('crear() lanza error con codigo RESTRICCION_UNICIDAD si codigo duplicado', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    await repo.crear(suscriptorBase({ codigo: '0099' }));
    let capturado: unknown;
    try {
      await repo.crear(suscriptorBase({ codigo: '0099', nombre_apellidos: 'Otro' }));
    } catch (e) {
      capturado = e;
    }
    expect(capturado).toBeInstanceOf(Error);
    expect((capturado as Error).message).toMatch(/codigo '0099'/);
    const cause = (capturado as { cause?: { codigo?: string } }).cause;
    expect(cause?.codigo).toBe('RESTRICCION_UNICIDAD');
  });

  it('listar() devuelve [] cuando no hay suscriptores', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    expect(await repo.listar()).toEqual([]);
  });

  it('listar() devuelve los suscriptores ordenados por codigo ascendente', async () => {
    const repo = crearSuscriptorRepositorySqlite(db);
    await repo.crear(suscriptorBase({ codigo: '0030' }));
    await repo.crear(suscriptorBase({ codigo: '0010' }));
    await repo.crear(suscriptorBase({ codigo: '0020' }));
    const lista = await repo.listar();
    expect(lista.map((s) => s.codigo)).toEqual(['0010', '0020', '0030']);
  });
});
