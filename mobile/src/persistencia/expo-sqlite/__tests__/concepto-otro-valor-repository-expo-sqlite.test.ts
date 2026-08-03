/**
 * Tests del adapter Expo SQLite del repositorio `ConceptoOtroValorRepository`.
 *
 * TDD: contrato del adapter Expo debe cumplir los mismos escenarios que el
 * Node (ver `dominio/persistencia/sqlite/__tests__/concepto-otro-valor-repository-sqlite.test.ts`).
 *
 * Cobertura:
 *  - T-5.14: tras seed, `buscarPorCodigo('RECONEXION')` retorna metadata completa.
 *  - T-5.15: `listar()` retorna 7 elementos.
 *  - T-5.16: `buscarPorCodigo` es case-insensitive.
 */

import {
  crearConceptoOtroValorRepositoryExpoSqlite,
  type ConceptoOtroValorRepositoryExpoSqlite,
} from '../concepto-otro-valor-repository-expo-sqlite';

interface ConceptoSeedRow {
  readonly id_concepto: number;
  readonly codigo: string;
  readonly descripcion: string;
  readonly version: string;
  readonly activo: number;
  readonly requiere_glosa: number;
  readonly created_at: string;
}

const SEED: readonly ConceptoSeedRow[] = [
  { id_concepto: 1, codigo: 'SALDO_ANTERIOR', descripcion: 'Saldo pendiente', version: '1038-2026-v1', activo: 1, requiere_glosa: 0, created_at: '2026-07-29T00:00:00.000Z' },
  { id_concepto: 2, codigo: 'INTERESES_AUTORIZADOS', descripcion: 'Intereses de mora autorizados', version: '1038-2026-v1', activo: 1, requiere_glosa: 1, created_at: '2026-07-29T00:00:00.000Z' },
  { id_concepto: 3, codigo: 'RECONEXION', descripcion: 'Cargo por reconexión', version: '1038-2026-v1', activo: 1, requiere_glosa: 0, created_at: '2026-07-29T00:00:00.000Z' },
  { id_concepto: 4, codigo: 'FINANCIACION', descripcion: 'Cuota financiación', version: '1038-2026-v1', activo: 1, requiere_glosa: 1, created_at: '2026-07-29T00:00:00.000Z' },
  { id_concepto: 5, codigo: 'MATERIALES_ACOMETIDA', descripcion: 'Materiales', version: '1038-2026-v1', activo: 1, requiere_glosa: 0, created_at: '2026-07-29T00:00:00.000Z' },
  { id_concepto: 6, codigo: 'AJUSTES_DEVOLUCIONES', descripcion: 'Ajustes', version: '1038-2026-v1', activo: 1, requiere_glosa: 1, created_at: '2026-07-29T00:00:00.000Z' },
  { id_concepto: 7, codigo: 'OTROS_AUTORIZADOS', descripcion: 'Otros autorizados', version: '1038-2026-v1', activo: 1, requiere_glosa: 1, created_at: '2026-07-29T00:00:00.000Z' },
];

interface MockDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly db: any;
  readonly close: () => Promise<void>;
}

function crearMockDbConSeed(): MockDb {
  const rowsByCodigo = new Map<string, ConceptoSeedRow>();
  for (const r of SEED) rowsByCodigo.set(r.codigo, r);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (/SELECT\s+\*\s+FROM\s+concepto_otro_valor\s+ORDER\s+BY/i.test(sql)) {
        if (/WHERE\s+activo\s*=\s*\?/i.test(sql)) {
          const activo = params[0] as number;
          return Array.from(rowsByCodigo.values())
            .filter((r) => r.activo === activo)
            .map((r) => ({ ...r }));
        }
        return Array.from(rowsByCodigo.values()).map((r) => ({ ...r }));
      }
      return [];
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (/SELECT\s+\*\s+FROM\s+concepto_otro_valor\s+WHERE\s+codigo/i.test(sql)) {
        const codigo = (params[0] as string).toUpperCase();
        const row = rowsByCodigo.get(codigo);
        return row ? { ...row } : null;
      }
      return null;
    }),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };

  return {
    db,
    close: async () => {
      await db.closeAsync();
    },
  };
}

describe('ConceptoOtroValorRepositoryExpoSqlite (contract)', () => {
  let mock: MockDb;
  let repo: ConceptoOtroValorRepositoryExpoSqlite;

  beforeEach(() => {
    mock = crearMockDbConSeed();
    repo = crearConceptoOtroValorRepositoryExpoSqlite(mock.db);
  });

  afterEach(async () => {
    await mock.close();
  });

  it('T-5.15: listar() retorna 7 elementos tras seed', async () => {
    const conceptos = await repo.listar();
    expect(conceptos).toHaveLength(7);
  });

  it('T-5.14: buscarPorCodigo("RECONEXION") retorna requiereGlosa = false', async () => {
    const encontrado = await repo.buscarPorCodigo('RECONEXION');
    expect(encontrado).not.toBeNull();
    expect(encontrado!.requiereGlosa).toBe(false);
    expect(encontrado!.version).toBe('1038-2026-v1');
  });

  it('T-5.14b: buscarPorCodigo("INTERESES_AUTORIZADOS") retorna requiereGlosa = true', async () => {
    const encontrado = await repo.buscarPorCodigo('INTERESES_AUTORIZADOS');
    expect(encontrado).not.toBeNull();
    expect(encontrado!.requiereGlosa).toBe(true);
  });

  it('T-5.16: buscarPorCodigo es case-insensitive', async () => {
    const upper = await repo.buscarPorCodigo('SALDO_ANTERIOR');
    const lower = await repo.buscarPorCodigo('saldo_anterior');
    expect(upper).not.toBeNull();
    expect(lower).not.toBeNull();
    expect(upper!.idConcepto).toBe(lower!.idConcepto);
  });

  it('T-5.X: cada concepto seed lleva version regulatoria 1038-2026-v1', async () => {
    const conceptos = await repo.listar();
    for (const c of conceptos) {
      expect(c.version).toBe('1038-2026-v1');
    }
  });

  it('T-5.Y: cerrar() no lanza error', async () => {
    await expect(repo.cerrar()).resolves.toBeUndefined();
  });
});
