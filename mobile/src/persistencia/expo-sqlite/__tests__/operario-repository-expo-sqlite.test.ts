/**
 * Tests unitarios para crearOperarioRepositoryExpoSqlite
 *
 * Strategy: mock manual de SQLiteDatabase — sólo los métodos que usa el repo:
 *   - execAsync  (inicializar)
 *   - getAllAsync (listar)
 *   - getFirstAsync (buscarPorDispositivoId)
 *
 * TDD Evidence:
 *   RED  → tests escritos antes de ejecutar (producción ya existe → tests nuevos para cobertura)
 *   GREEN → implementación mínima ya presente en producción
 *   TRIANGULATE → 2 casos por comportamiento (con datos / sin datos)
 */

import { crearOperarioRepositoryExpoSqlite } from '../operario-repository-expo-sqlite';
import type { Operario } from '../../../operarios/types';

// ── helpers ────────────────────────────────────────────────────────────────

function buildRow(overrides: Partial<{
  id_operario: number;
  numero_cedula: string;
  nombre: string;
  email: string;
  rol: string;
  estado: string;
  dispositivo_id: string | null;
  created_at: string | null;
}> = {}) {
  return {
    id_operario: 1,
    numero_cedula: '123',
    nombre: 'Ana',
    email: 'ana@test.com',
    rol: 'operario',
    estado: 'activo',
    dispositivo_id: null,
    created_at: null,
    ...overrides,
  };
}

function buildDb(overrides: {
  getAllAsync?: jest.Mock;
  getFirstAsync?: jest.Mock;
  execAsync?: jest.Mock;
} = {}) {
  return {
    execAsync: overrides.execAsync ?? jest.fn().mockResolvedValue(undefined),
    getAllAsync: overrides.getAllAsync ?? jest.fn().mockResolvedValue([]),
    getFirstAsync: overrides.getFirstAsync ?? jest.fn().mockResolvedValue(null),
  } as unknown as import('expo-sqlite').SQLiteDatabase;
}

// ── inicializar ────────────────────────────────────────────────────────────

describe('inicializar()', () => {
  it('llama execAsync con CREATE TABLE IF NOT EXISTS', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const repo = crearOperarioRepositoryExpoSqlite(buildDb({ execAsync }));

    await repo.inicializar();

    expect(execAsync).toHaveBeenCalledTimes(1);
    const sql: string = execAsync.mock.calls[0][0];
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS operarios/i);
  });
});

// ── listar ─────────────────────────────────────────────────────────────────

describe('listar()', () => {
  it('retorna lista de operarios cuando hay datos', async () => {
    const rows = [
      buildRow({ id_operario: 1, nombre: 'Ana', numero_cedula: '111' }),
      buildRow({ id_operario: 2, nombre: 'Luis', numero_cedula: '222' }),
    ];
    const db = buildDb({ getAllAsync: jest.fn().mockResolvedValue(rows) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.listar();

    expect(resultado).toHaveLength(2);
    expect(resultado[0].nombre).toBe('Ana');
    expect(resultado[1].nombre).toBe('Luis');
  });

  it('retorna array vacío cuando no hay datos', async () => {
    const db = buildDb({ getAllAsync: jest.fn().mockResolvedValue([]) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.listar();

    // Vacío porque no hay filas en la DB — producción recorrió el array vacío
    expect(resultado).toEqual([]);
  });
});

// ── buscarPorDispositivoId ─────────────────────────────────────────────────

describe('buscarPorDispositivoId()', () => {
  it('retorna un Operario correcto cuando existe', async () => {
    const row = buildRow({
      id_operario: 7,
      nombre: 'Carlos',
      numero_cedula: '999',
      email: 'carlos@test.com',
      rol: 'supervisor',
      estado: 'activo',
      dispositivo_id: 'device-abc',
      created_at: '2024-01-15',
    });
    const db = buildDb({ getFirstAsync: jest.fn().mockResolvedValue(row) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorDispositivoId('device-abc');

    const esperado: Operario = {
      id_operario: 7,
      nombre: 'Carlos',
      numero_cedula: '999',
      email: 'carlos@test.com',
      rol: 'supervisor',
      estado: 'activo',
      dispositivo_id: 'device-abc',
      created_at: '2024-01-15',
    };
    expect(resultado).toEqual(esperado);
  });

  it('retorna null cuando no existe dispositivo con ese id', async () => {
    const db = buildDb({ getFirstAsync: jest.fn().mockResolvedValue(null) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorDispositivoId('no-existe');

    expect(resultado).toBeNull();
  });
});
