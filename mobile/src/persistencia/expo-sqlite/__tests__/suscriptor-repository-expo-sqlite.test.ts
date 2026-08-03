/**
 * Contrato del UPDATE parcial de suscriptores en el adapter expo-sqlite.
 *
 * TDD Evidence:
 *   RED: estos casos describen los campos que el UPDATE todavía pierde o
 *        convierte en NULL antes de la whitelist.
 *   GREEN: la implementación debe actualizar únicamente campos explícitos.
 *   TRIANGULATE: cubre un campo simple, booleano, multi-tenant, ubicación,
 *                input vacío y campo fuera de whitelist.
 */

import { crearSuscriptorRepositoryExpoSqlite } from '../suscriptor-repository-expo-sqlite';
import type { ActualizarSuscriptorInput, Suscriptor } from '@dominio/suscriptores';

interface SuscriptorRowFixture {
  readonly id_suscriptor: number;
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly cedula: string;
  readonly email: string | null;
  readonly telefono: string | null;
  readonly municipio: string;
  readonly sector: string | null;
  readonly direccion: string;
  readonly estrato: number;
  readonly matricula_inmobiliaria: string | null;
  readonly numero_catastral: string | null;
  readonly aplica_subsidio: number;
  readonly id_prestador: number;
  readonly categoria_uso: Suscriptor['categoria_uso'];
  readonly estado: string;
  readonly created_at: string;
}

function buildRow(overrides: Partial<SuscriptorRowFixture> = {}): SuscriptorRowFixture {
  return {
    id_suscriptor: 7,
    codigo: '0007',
    nombre_apellidos: 'Ana Original',
    cedula: '51800012',
    email: null,
    telefono: null,
    municipio: 'Cáqueza',
    sector: 'Centro',
    direccion: 'Cra 1 # 2-03',
    estrato: 3,
    matricula_inmobiliaria: 'MAT-7',
    numero_catastral: 'CAT-7',
    aplica_subsidio: 0,
    id_prestador: 1,
    categoria_uso: 'residencial',
    estado: 'activo',
    created_at: '2026-07-16T12:00:00.000Z',
    ...overrides,
  };
}

function expectedSuscriptor(row: SuscriptorRowFixture): Suscriptor {
  return {
    id_suscriptor: row.id_suscriptor,
    codigo: row.codigo,
    nombre_apellidos: row.nombre_apellidos,
    cedula: row.cedula,
    email: row.email ?? undefined,
    telefono: row.telefono ?? undefined,
    municipio: row.municipio,
    sector: row.sector ?? undefined,
    direccion: row.direccion,
    estrato: row.estrato as Suscriptor['estrato'],
    matricula_inmobiliaria: row.matricula_inmobiliaria ?? undefined,
    numero_catastral: row.numero_catastral ?? undefined,
    aplica_subsidio: row.aplica_subsidio === 1,
    id_prestador: row.id_prestador,
    categoria_uso: row.categoria_uso,
    estado: row.estado as Suscriptor['estado'],
    created_at: row.created_at,
  };
}

function asActualizarInput(cambios: object): ActualizarSuscriptorInput {
  // T-UPD-7 simula datos que llegan desde un boundary externo. El repo debe
  // filtrar claves desconocidas incluso si el runtime las contiene.
  return cambios as unknown as ActualizarSuscriptorInput;
}

function buildDb(initialRow: SuscriptorRowFixture) {
  let currentRow = { ...initialRow };
  const runAsync = jest.fn().mockImplementation(async (sql: string, ...params: unknown[]) => {
    const setPart = /SET([\s\S]+)WHERE/i.exec(sql)?.[1];
    if (setPart === undefined) {
      return { lastInsertRowId: 0, changes: 0 };
    }

    const columns = setPart
      .split(',')
      .map((clause) => clause.split('=')[0]?.trim())
      .filter((column): column is string => column !== undefined && column.length > 0);
    const id = params.at(-1);
    if (id !== currentRow.id_suscriptor) {
      return { lastInsertRowId: 0, changes: 0 };
    }

    const nextRow: Record<string, unknown> = { ...currentRow };
    columns.forEach((column, index) => {
      const value = params[index];
      nextRow[column] = typeof value === 'boolean' ? (value ? 1 : 0) : value ?? null;
    });
    currentRow = nextRow as unknown as SuscriptorRowFixture;
    return { lastInsertRowId: 0, changes: 1 };
  });
  const getFirstAsync = jest.fn().mockImplementation(async () => ({ ...currentRow }));

  const db = {
    runAsync,
    getFirstAsync,
    getAllAsync: jest.fn().mockResolvedValue([]),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('expo-sqlite').SQLiteDatabase;

  return { db, runAsync, getFirstAsync };
}

describe('crearSuscriptorRepositoryExpoSqlite.actualizar()', () => {
  it('T-UPD-1: cambia solo nombre y deja los demás campos intactos', async () => {
    const original = buildRow();
    const { db } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {
      nombre_apellidos: 'Ana Actualizada',
    });

    expect(actualizado).toEqual(
      expectedSuscriptor({ ...original, nombre_apellidos: 'Ana Actualizada' }),
    );
  });

  it('T-UPD-2: actualiza aplica_subsidio explícitamente a true', async () => {
    const original = buildRow({ aplica_subsidio: 0 });
    const { db } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {
      aplica_subsidio: true,
    });

    expect(actualizado.aplica_subsidio).toBe(true);
    expect(actualizado.nombre_apellidos).toBe(original.nombre_apellidos);
  });

  it('T-UPD-3: actualiza categoria_uso explícitamente a comercial', async () => {
    const original = buildRow({ categoria_uso: 'residencial' });
    const { db } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {
      categoria_uso: 'comercial',
    });

    expect(actualizado.categoria_uso).toBe('comercial');
    expect(actualizado.id_prestador).toBe(original.id_prestador);
  });

  it('T-UPD-4: actualiza id_prestador explícitamente', async () => {
    const original = buildRow({ id_prestador: 1 });
    const { db } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {
      id_prestador: 5,
    });

    expect(actualizado.id_prestador).toBe(5);
    expect(actualizado.categoria_uso).toBe(original.categoria_uso);
  });

  it('T-UPD-6: input vacío no ejecuta UPDATE y retorna la fila actual', async () => {
    const original = buildRow();
    const { db, runAsync } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {});

    expect(runAsync).not.toHaveBeenCalled();
    expect(actualizado).toEqual(expectedSuscriptor(original));
  });

  it('T-UPD-7: ignora campos fuera de la whitelist y no toca la fila', async () => {
    const original = buildRow();
    const { db, runAsync } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(
      original.id_suscriptor,
      asActualizarInput({ codigo: '9999' }),
    );

    expect(runAsync).not.toHaveBeenCalled();
    expect(actualizado).toEqual(expectedSuscriptor(original));
  });

  it('T-UPD-8: actualiza email y telefono explícitamente', async () => {
    const original = buildRow();
    const { db } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {
      email: 'ana@example.com',
      telefono: '3101234567',
    });

    expect(actualizado.email).toBe('ana@example.com');
    expect(actualizado.telefono).toBe('3101234567');
  });

  it('T-UPD-9: omite contactos almacenados como NULL', async () => {
    const original = buildRow({ email: null, telefono: null });
    const { db } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const encontrado = await repo.buscarPorId(original.id_suscriptor);

    expect(encontrado).toEqual(expectedSuscriptor(original));
    expect(encontrado).not.toHaveProperty('email');
    expect(encontrado).not.toHaveProperty('telefono');
  });
});
