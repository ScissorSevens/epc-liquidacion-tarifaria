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
  // Phase 3.3: 4 campos de verificación oficial del estrato.
  // Default conservador 'PENDIENTE' para legacy data.
  readonly estado_verificacion: string;
  readonly fuente_estrato: string | null;
  readonly fecha_verificacion_estrato: string | null;
  readonly soporte_estrato_url: string | null;
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
    estado_verificacion: 'PENDIENTE',
    fuente_estrato: null,
    fecha_verificacion_estrato: null,
    soporte_estrato_url: null,
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
    estado_verificacion: row.estado_verificacion as Suscriptor['estado_verificacion'],
    fuente_estrato: row.fuente_estrato ?? undefined,
    fecha_verificacion_estrato: row.fecha_verificacion_estrato ?? undefined,
    soporte_estrato_url: row.soporte_estrato_url ?? undefined,
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

  // ── Phase 3.3 RED: round-trip 4 campos verificación oficial del estrato ──
  // Default conservador 'PENDIENTE' para legacy data. La admin debe
  // cargar VERIFICADO + fuente + fecha + soporte para que el motor
  // liquide subsidio residencial (regulatory gate).
  it('T-SUS-VER-1: suscriptor legacy se lee con estado_verificacion=PENDIENTE por default', async () => {
    const legacy = buildRow({
      estado_verificacion: 'PENDIENTE',
      fuente_estrato: null,
      fecha_verificacion_estrato: null,
      soporte_estrato_url: null,
    });
    const { db } = buildDb(legacy);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const encontrado = await repo.buscarPorId(legacy.id_suscriptor);
    expect(encontrado).not.toBeNull();

    expect(encontrado?.estado_verificacion).toBe('PENDIENTE');
    expect(encontrado?.fuente_estrato ?? null).toBeNull();
    expect(encontrado?.fecha_verificacion_estrato ?? null).toBeNull();
    expect(encontrado?.soporte_estrato_url ?? null).toBeNull();
  });

  it('T-SUS-VER-2: actualizar() persiste los 4 campos (VERIFICADO + fuente + fecha + soporte)', async () => {
    const original = buildRow({ estado_verificacion: 'PENDIENTE' });
    const { db, runAsync } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {
      estado_verificacion: 'VERIFICADO',
      fuente_estrato: 'DANE 2025',
      fecha_verificacion_estrato: '2026-08-10',
      soporte_estrato_url: 'https://docs.epc.local/soportes/estrato-0007.pdf',
    });

    expect(actualizado.estado_verificacion).toBe('VERIFICADO');
    expect(actualizado.fuente_estrato).toBe('DANE 2025');
    expect(actualizado.fecha_verificacion_estrato).toBe('2026-08-10');
    expect(actualizado.soporte_estrato_url).toBe('https://docs.epc.local/soportes/estrato-0007.pdf');
    // El UPDATE emite los 4 campos en el SET clause.
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/estado_verificacion\s*=\s*\?/i);
    expect(sql).toMatch(/fuente_estrato\s*=\s*\?/i);
    expect(sql).toMatch(/fecha_verificacion_estrato\s*=\s*\?/i);
    expect(sql).toMatch(/soporte_estrato_url\s*=\s*\?/i);
  });

  it('T-SUS-VER-3: rechazar estrato (RECHAZADO) persiste estado_verificacion=RECHAZADO', async () => {
    const original = buildRow({ estado_verificacion: 'PENDIENTE' });
    const { db } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const actualizado = await repo.actualizar(original.id_suscriptor, {
      estado_verificacion: 'RECHAZADO',
      fuente_estrato: 'Impugnación alcaldía Q2 2026',
    });

    expect(actualizado.estado_verificacion).toBe('RECHAZADO');
    expect(actualizado.fuente_estrato).toBe('Impugnación alcaldía Q2 2026');
    // Defaults de soporte_estrato_url y fecha: siguen NULL.
    expect(actualizado.soporte_estrato_url ?? null).toBeNull();
    expect(actualizado.fecha_verificacion_estrato ?? null).toBeNull();
  });

  it('T-SUS-VER-4: campos de verificación están en la whitelist de actualizar()', async () => {
    const original = buildRow();
    const { db, runAsync } = buildDb(original);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    await repo.actualizar(original.id_suscriptor, {
      estado_verificacion: 'VERIFICADO',
    });

    // Sí emite UPDATE (no se filtra como whitelist miss).
    expect(runAsync).toHaveBeenCalledTimes(1);
    const sql: string = runAsync.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE\s+suscriptor\s+SET/i);
    expect(sql).toMatch(/estado_verificacion/);
  });

  it('T-SUS-VER-5: buscarPorId() retorna los 4 campos completos cuando están poblados', async () => {
    const verificado = buildRow({
      estado_verificacion: 'VERIFICADO',
      fuente_estrato: 'Acto administrativo 042 de 2024',
      fecha_verificacion_estrato: '2024-06-15',
      soporte_estrato_url: 'https://docs.epc.local/actos/042-2024.pdf',
    });
    const { db } = buildDb(verificado);
    const repo = crearSuscriptorRepositoryExpoSqlite(db);

    const encontrado = await repo.buscarPorId(verificado.id_suscriptor);
    expect(encontrado).not.toBeNull();

    expect(encontrado?.estado_verificacion).toBe('VERIFICADO');
    expect(encontrado?.fuente_estrato).toBe('Acto administrativo 042 de 2024');
    expect(encontrado?.fecha_verificacion_estrato).toBe('2024-06-15');
    expect(encontrado?.soporte_estrato_url).toBe('https://docs.epc.local/actos/042-2024.pdf');
  });
});
