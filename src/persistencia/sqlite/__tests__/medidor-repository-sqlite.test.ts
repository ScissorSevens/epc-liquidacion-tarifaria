/**
 * Tests del adapter SQLite de `MedidorRepository`.
 *
 * Espejo del patron de `suscriptor-repository-sqlite.test.ts`. Usa el
 * fixture `crearDBTest` que ya tiene migration 005_medidor aplicada.
 *
 * Cada test pre-crea un suscriptor (id=1) para satisfacer la FK del
 * medidor, salvo los que prueban explicitamente FK violada.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import { crearDBTest } from '../__fixtures__/crear-db-test';
import { crearMedidorRepositorySqlite } from '../medidor-repository-sqlite';
import type { MedidorBorrador } from '../../../medidores';

function medidorBase(overrides: Partial<MedidorBorrador> = {}): MedidorBorrador {
  return {
    numero_medidor: 'M-001',
    id_suscriptor: 1,
    fecha_instalacion: '2024-01-01',
    estado: 'activo',
    ...overrides,
  };
}

function sembrarSuscriptor(db: DatabaseType, codigo = '0001'): number {
  const r = db
    .prepare(
      `INSERT INTO suscriptor (codigo, nombre_apellidos, direccion, estrato, estado)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(codigo, 'Pepe', 'Calle 1', 3, 'activo');
  return Number(r.lastInsertRowid);
}

describe('crearMedidorRepositorySqlite', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = crearDBTest();
  });

  afterEach(() => {
    db.close();
  });

  it('crear() persiste el medidor y lo devuelve con id_medidor y created_at', async () => {
    sembrarSuscriptor(db);
    const repo = crearMedidorRepositorySqlite(db);
    const guardado = await repo.crear(medidorBase());

    expect(guardado.id_medidor).toBeGreaterThan(0);
    expect(typeof guardado.created_at).toBe('string');
    expect(guardado.numero_medidor).toBe('M-001');
    expect(guardado.id_suscriptor).toBe(1);
    expect(guardado.estado).toBe('activo');
  });

  it('buscarPorId() devuelve el medidor persistido', async () => {
    sembrarSuscriptor(db);
    const repo = crearMedidorRepositorySqlite(db);
    const guardado = await repo.crear(medidorBase());
    const recuperado = await repo.buscarPorId(guardado.id_medidor);
    expect(recuperado).toEqual(guardado);
  });

  it('buscarPorId() devuelve null si el id no existe', async () => {
    const repo = crearMedidorRepositorySqlite(db);
    expect(await repo.buscarPorId(9999)).toBeNull();
  });

  it('crear() lanza error con codigo RESTRICCION_INTEGRIDAD si FK invalida', async () => {
    const repo = crearMedidorRepositorySqlite(db);
    let capturado: unknown;
    try {
      await repo.crear(medidorBase({ id_suscriptor: 999 }));
    } catch (e) {
      capturado = e;
    }
    expect(capturado).toBeInstanceOf(Error);
    expect((capturado as Error).message).toMatch(/suscriptor 999/);
    const cause = (capturado as { cause?: { codigo?: string } }).cause;
    expect(cause?.codigo).toBe('RESTRICCION_INTEGRIDAD');
  });

  it('crear() lanza error con codigo RESTRICCION_UNICIDAD si numero_medidor duplicado', async () => {
    sembrarSuscriptor(db);
    const repo = crearMedidorRepositorySqlite(db);
    await repo.crear(medidorBase({ numero_medidor: 'M-DUP' }));
    let capturado: unknown;
    try {
      await repo.crear(medidorBase({ numero_medidor: 'M-DUP' }));
    } catch (e) {
      capturado = e;
    }
    expect(capturado).toBeInstanceOf(Error);
    expect((capturado as Error).message).toMatch(/M-DUP/);
    const cause = (capturado as { cause?: { codigo?: string } }).cause;
    expect(cause?.codigo).toBe('RESTRICCION_UNICIDAD');
  });

  it('buscarPorNumero() devuelve el medidor cuando existe (hit)', async () => {
    sembrarSuscriptor(db);
    const repo = crearMedidorRepositorySqlite(db);
    const guardado = await repo.crear(medidorBase({ numero_medidor: 'M-42' }));
    const recuperado = await repo.buscarPorNumero('M-42');
    expect(recuperado).toEqual(guardado);
  });

  it('buscarPorNumero() devuelve null cuando no existe (miss)', async () => {
    const repo = crearMedidorRepositorySqlite(db);
    expect(await repo.buscarPorNumero('M-NOPE')).toBeNull();
  });

  it('existePorNumero() devuelve true si el numero existe', async () => {
    sembrarSuscriptor(db);
    const repo = crearMedidorRepositorySqlite(db);
    await repo.crear(medidorBase({ numero_medidor: 'M-7' }));
    expect(await repo.existePorNumero('M-7')).toBe(true);
  });

  it('existePorNumero() devuelve false si el numero no existe', async () => {
    const repo = crearMedidorRepositorySqlite(db);
    expect(await repo.existePorNumero('M-9999')).toBe(false);
  });

  it('listarPorSuscriptor() devuelve [] si no hay medidores', async () => {
    sembrarSuscriptor(db);
    const repo = crearMedidorRepositorySqlite(db);
    expect(await repo.listarPorSuscriptor(1)).toEqual([]);
  });

  it('listarPorSuscriptor() devuelve solo los medidores del suscriptor pedido', async () => {
    const id1 = sembrarSuscriptor(db, '0001');
    const id2 = sembrarSuscriptor(db, '0002');
    const repo = crearMedidorRepositorySqlite(db);
    await repo.crear(medidorBase({ numero_medidor: 'M-A', id_suscriptor: id1 }));
    await repo.crear(medidorBase({ numero_medidor: 'M-B', id_suscriptor: id2 }));
    await repo.crear(medidorBase({ numero_medidor: 'M-C', id_suscriptor: id1 }));
    const lista = await repo.listarPorSuscriptor(id1);
    expect(lista.map((m) => m.numero_medidor)).toEqual(['M-A', 'M-C']);
  });

  it('listar() devuelve [] cuando no hay medidores', async () => {
    const repo = crearMedidorRepositorySqlite(db);
    expect(await repo.listar()).toEqual([]);
  });

  it('listar() devuelve los medidores ordenados por numero_medidor', async () => {
    sembrarSuscriptor(db);
    const repo = crearMedidorRepositorySqlite(db);
    await repo.crear(medidorBase({ numero_medidor: 'M-30' }));
    await repo.crear(medidorBase({ numero_medidor: 'M-10' }));
    await repo.crear(medidorBase({ numero_medidor: 'M-20' }));
    const lista = await repo.listar();
    expect(lista.map((m) => m.numero_medidor)).toEqual(['M-10', 'M-20', 'M-30']);
  });
});
