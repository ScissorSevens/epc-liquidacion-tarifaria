/**
 * Helpers para tests del adapter Expo SQLite de Factura.
 *
 * Mock in-memory de `expo-sqlite`'s `SQLiteDatabase` limitado al set de
 * queries que dispara el adapter de Factura:
 *   - `runAsync(INSERT INTO factura ...)` con 17 parametros.
 *   - `runAsync(UPDATE factura SET ... WHERE id = ?)`.
 *   - `getFirstAsync(SELECT * FROM factura WHERE id = ?)`.
 *   - `getFirstAsync(SELECT * FROM factura WHERE liquidacion_id = ?)`.
 *   - `getAllAsync(SELECT * FROM factura WHERE id_periodo = ?)`.
 *   - `getAllAsync(SELECT * FROM factura WHERE id_suscriptor = ?)`.
 *   - `getAllAsync(SELECT * FROM factura ORDER BY rowid)`.
 *
 * Builders consistentes para Factura / FacturaRow / FacturaSnapshot.
 *
 * Notas:
 *   - No soporta transacciones (el adapter de Factura no las usa).
 *   - No simula UNIQUE constraint failures — los tests que las requieren
 *     setean mocks.Throw programaticamente.
 *   - El estado es mutable entre tests: cada test crea su propio mock via
 *     `crearMockExpoSqliteDb()` y no comparte estado.
 */

import type { FacturaSnapshot } from '@dominio/factura/types';

export interface FacturaRowFixture {
  readonly id: string;
  readonly numero_factura: string;
  readonly estado: string;
  readonly fecha_emision: string;
  readonly snapshot: string;
  readonly hash: string;
  readonly liquidacion_id: string;
  readonly id_periodo: string;
  readonly id_suscriptor: number;
  readonly created_at: string;
  readonly motivo_anulacion: string | null;
  readonly fecha_anulacion: string | null;
  readonly reemplaza_a: string | null;
  readonly codigo_verificacion: string | null;
  readonly referencia_pago: string | null;
  readonly qr_pago: string | null;
  readonly version_tarifa_aplicada: string | null;
}

export function buildSnapshot(overrides: Partial<FacturaSnapshot> = {}): FacturaSnapshot {
  // Snapshot v2 minimo pero completo — el adapter pasa por el JSON.parse,
  // asi que debe tener las 4 ramas que `fromRow` espera.
  return {
    prestador: {
      id_prestador: 1,
      codigo: '0001',
      nombre: 'EPC Demo',
      nit: '900123456-7',
      municipio: 'Caqueza',
      departamento: 'Cundinamarca',
      representante_legal: 'Juan Demo',
      representante_legal_cedula: '12345678',
      segmento: 2,
    },
    suscriptor: {
      codigo: '0007',
      nombre_apellidos: 'Ana Demo',
      cedula: '51800012',
      email: 'ana@example.com',
      telefono: '3101234567',
      municipio: 'Caqueza',
      sector: 'Centro',
      calle: 'Cra 1',
      direccion: 'Cra 1 # 2-03',
      estrato: 3,
      matricula_inmobiliaria: 'MAT-7',
      numero_catastral: 'CAT-7',
      aplica_subsidio: false,
      id_prestador: 1,
      categoria_uso: 'residencial',
      estado: 'activo',
    },
    medidor: {
      numero_medidor: 'M-1',
      fecha_instalacion: '2024-01-01',
      estado: 'activo',
    },
    operario: {
      cedula: '51800012',
      nombre: 'Ana Demo',
      rol: 'operario',
      estado: 'activo',
    },
    lectura: {
      lectura_actual: 100,
      lectura_anterior: 80,
      timestamp_captura: '2026-07-29T10:00:00.000Z',
      timestamp_sync: null,
      estado_sync: 'pendiente',
      estado_validacion: 'validado',
      evidencia_foto_path: null,
      evidencia_foto_hash: null,
      observaciones: null,
    },
    periodo: {
      id_periodo: '202607',
      fecha_inicio: '2026-07-01',
      fecha_fin: '2026-07-31',
    },
    liquidacion: {
      id: 'L-001',
      resultado: { total: 12345, metadata: { version_motor: 'v2' } },
    },
    otros_valores: [],
    saldo_anterior: 0,
    metadata: {
      hash_version: 'v2',
      fecha_emision: '2026-07-29T00:00:00.000Z',
      catalogo_version: '1038-2026-v1',
    },
    ...overrides,
  } as FacturaSnapshot;
}

export function buildFacturaRow(
  overrides: Partial<FacturaRowFixture> = {},
): FacturaRowFixture {
  return {
    id: 'F-001',
    numero_factura: 'F-2026-001',
    estado: 'EMITIDA',
    fecha_emision: '2026-07-29T00:00:00.000Z',
    snapshot: JSON.stringify(buildSnapshot()),
    hash: 'a'.repeat(64),
    liquidacion_id: 'L-001',
    id_periodo: '202607',
    id_suscriptor: 7,
    created_at: '2026-07-29T00:00:00.000Z',
    motivo_anulacion: null,
    fecha_anulacion: null,
    reemplaza_a: null,
    codigo_verificacion: 'ABC123XYZ0',
    referencia_pago: '1-202607-1-ABCD',
    qr_pago: JSON.stringify({
      codigo_verificacion: 'ABC123XYZ0',
      valor_total: 12345,
      fecha_emision: '2026-07-29',
      referencia_pago: '1-202607-1-ABCD',
    }),
    version_tarifa_aplicada: '1038-2026-v1',
    ...overrides,
  };
}

interface MockState {
  rows: FacturaRowFixture[];
  log: Array<{ sql: string; params: unknown[] }>;
}

interface MockApi {
  readonly db: import('expo-sqlite').SQLiteDatabase;
  readonly state: MockState;
  readonly seed: (rows: readonly FacturaRowFixture[]) => void;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Crea un mock controlado del `SQLiteDatabase` de expo-sqlite. Solo soporta
 * las queries que dispara el adapter de Factura (ver JSDoc). Cada test
 * invoca esto para obtener un mock fresco sin estado compartido.
 */
export function crearMockExpoSqliteDb(): MockApi {
  const state: MockState = {
    rows: [],
    log: [],
  };

  function matchInsertFactura(params: readonly unknown[]): FacturaRowFixture | null {
    if (params.length < 17) return null;
    const [
      id,
      numero_factura,
      estado,
      fecha_emision,
      snapshot,
      hash,
      liquidacion_id,
      id_periodo,
      id_suscriptor,
      created_at,
      motivo_anulacion,
      fecha_anulacion,
      reemplaza_a,
      codigo_verificacion,
      referencia_pago,
      qr_pago,
      version_tarifa_aplicada,
    ] = params;
    return {
      id: id as string,
      numero_factura: numero_factura as string,
      estado: estado as string,
      fecha_emision: fecha_emision as string,
      snapshot: snapshot as string,
      hash: hash as string,
      liquidacion_id: liquidacion_id as string,
      id_periodo: id_periodo as string,
      id_suscriptor: id_suscriptor as number,
      created_at: created_at as string,
      motivo_anulacion: motivo_anulacion as string | null,
      fecha_anulacion: fecha_anulacion as string | null,
      reemplaza_a: reemplaza_a as string | null,
      codigo_verificacion: codigo_verificacion as string | null,
      referencia_pago: referencia_pago as string | null,
      qr_pago: qr_pago as string | null,
      version_tarifa_aplicada: version_tarifa_aplicada as string | null,
    };
  }

  function matchUpdateFactura(params: readonly unknown[]): boolean {
    if (params.length < 4) return false;
    const [estado, motivo, fecha, id] = params;
    const idx = state.rows.findIndex((r) => r.id === (id as string));
    if (idx === -1) return false;
    const row = state.rows[idx]!;
    state.rows[idx] = {
      ...row,
      estado: estado as string,
      motivo_anulacion: motivo as string | null,
      fecha_anulacion: fecha as string | null,
    };
    return true;
  }

  function dispatchRunAsync(sql: string, ...params: unknown[]) {
    state.log.push({ sql, params });
    const n = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    if (n.startsWith('INSERT INTO FACTURA')) {
      const row = matchInsertFactura(params);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      // UNIQUE: liquidacion_id no anulada => verifica antes de pushear.
      const duplicado =
        row.liquidacion_id &&
        state.rows.some((r) => r.liquidacion_id === row.liquidacion_id && r.estado !== 'ANULADA');
      if (duplicado) {
        const err = new Error('UNIQUE constraint failed: factura.liquidacion_id');
        throw err;
      }
      const dupRefPago =
        row.referencia_pago !== null &&
        row.referencia_pago !== '' &&
        state.rows.some(
          (r) => r.referencia_pago === row.referencia_pago && r.referencia_pago !== null,
        );
      if (dupRefPago) {
        const err = new Error(
          'UNIQUE constraint failed: factura.referencia_pago',
        );
        throw err;
      }
      // PRIMARY KEY duplicado
      if (state.rows.some((r) => r.id === row.id)) {
        const err = new Error(`UNIQUE constraint failed: factura.id ${row.id}`);
        throw err;
      }
      state.rows.push(row);
      return { lastInsertRowId: state.rows.length, changes: 1 };
    }

    if (n.startsWith('UPDATE FACTURA')) {
      const ok = matchUpdateFactura(params);
      return { lastInsertRowId: 0, changes: ok ? 1 : 0 };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  function dispatchGetFirstAsync(sql: string, ...params: unknown[]) {
    state.log.push({ sql, params });
    const n = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    if (n.startsWith('SELECT * FROM FACTURA WHERE ID = ?')) {
      const [id] = params;
      const found = state.rows.find((r) => r.id === id);
      return found ? { ...found } : null;
    }

    if (n.startsWith('SELECT * FROM FACTURA WHERE LIQUIDACION_ID = ?')) {
      const [liquidacion_id] = params;
      const found = state.rows.find(
        (r) => r.liquidacion_id === liquidacion_id && r.estado !== 'ANULADA',
      );
      return found ? { ...found } : null;
    }

    return null;
  }

  function dispatchGetAllAsync(sql: string, ...params: unknown[]) {
    state.log.push({ sql, params });
    const n = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    if (n.startsWith('SELECT * FROM FACTURA WHERE ID_PERIODO = ?')) {
      const [id_periodo] = params;
      return state.rows.filter((r) => r.id_periodo === id_periodo).map((r) => ({ ...r }));
    }

    if (n.startsWith('SELECT * FROM FACTURA WHERE ID_SUSCRIPTOR = ?')) {
      const [id_suscriptor] = params;
      return state.rows
        .filter((r) => r.id_suscriptor === id_suscriptor)
        .map((r) => ({ ...r }));
    }

    if (n.startsWith('SELECT * FROM FACTURA ORDER BY')) {
      return state.rows.map((r) => ({ ...r }));
    }

    return [];
  }

  const db = {
    runAsync: jest.fn((sql: string, ...params: unknown[]) =>
      Promise.resolve(dispatchRunAsync(sql, ...params)),
    ),
    getFirstAsync: jest.fn((sql: string, ...params: unknown[]) =>
      Promise.resolve(dispatchGetFirstAsync(sql, ...params)),
    ),
    getAllAsync: jest.fn((sql: string, ...params: unknown[]) =>
      Promise.resolve(dispatchGetAllAsync(sql, ...params)),
    ),
    execAsync: jest.fn().mockResolvedValue(undefined),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('expo-sqlite').SQLiteDatabase;

  return {
    db,
    state,
    seed(rows) {
      state.rows = rows.map((r) => deepClone(r));
    },
  };
}
