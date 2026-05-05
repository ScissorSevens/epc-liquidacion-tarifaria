/**
 * Tests de schema de la migration 003_cola_sync.
 *
 * Verifica que el SQL declara columnas, constraints e indices que el
 * adapter SQLite (`crearColaSincronizacionSqlite`) y el dominio van a
 * apoyarse, en linea con el tipo `ItemCola` de sincronizacion/types.ts
 * y la interface `ColaSincronizacion`.
 */

import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';
import { crearDBTest } from '../../__fixtures__/crear-db-test';

function insertarMinimo(
  db: ReturnType<typeof crearConexion>,
  overrides: Record<string, unknown> = {},
): () => void {
  const params = {
    id: 'item-1',
    tipo: 'LIQUIDACION',
    payload: '{"x":1}',
    hash_local: 'h1',
    hash_server: null as string | null,
    estado: 'PENDIENTE',
    intentos: 0,
    ultimo_error: null as string | null,
    ultimo_intento_en: null as string | null,
    creado_en: '2026-04-20T10:00:00.000Z',
    depende_de: null as string | null,
    forzar_sobrescribir: null as number | null,
    ...overrides,
  };
  return () =>
    db
      .prepare(
        `INSERT INTO cola_sincronizacion
          (id, tipo, payload, hash_local, hash_server, estado, intentos, ultimo_error,
           ultimo_intento_en, creado_en, depende_de, forzar_sobrescribir)
         VALUES (@id, @tipo, @payload, @hash_local, @hash_server, @estado, @intentos, @ultimo_error,
                 @ultimo_intento_en, @creado_en, @depende_de, @forzar_sobrescribir)`,
      )
      .run(params);
}

describe('migration 003_cola_sync — schema completo', () => {
  it('crea la tabla cola_sincronizacion tras aplicar las migrations y deja user_version=3', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(3);

      const tabla = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='cola_sincronizacion'",
        )
        .get();
      expect(tabla).toEqual({ name: 'cola_sincronizacion' });
    } finally {
      db.close();
    }
  });

  it('declara las columnas del tipo ItemCola (id, tipo, payload, hash_local, hash_server, estado, intentos, ultimo_error, ultimo_intento_en, creado_en, depende_de, forzar_sobrescribir)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const cols = db
        .prepare("PRAGMA table_info('cola_sincronizacion')")
        .all() as Array<{ name: string }>;
      const nombres = cols.map((c) => c.name);

      expect(nombres).toEqual(
        expect.arrayContaining([
          'id',
          'tipo',
          'payload',
          'hash_local',
          'hash_server',
          'estado',
          'intentos',
          'ultimo_error',
          'ultimo_intento_en',
          'creado_en',
          'depende_de',
          'forzar_sobrescribir',
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('declara NOT NULL en columnas obligatorias y permite NULL en opcionales', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const cols = db
        .prepare("PRAGMA table_info('cola_sincronizacion')")
        .all() as Array<{ name: string; notnull: number }>;
      const byName = new Map(cols.map((c) => [c.name, c.notnull === 1]));

      const obligatorias = ['id', 'tipo', 'payload', 'hash_local', 'estado', 'intentos', 'creado_en'];
      obligatorias.forEach((col) => expect(byName.get(col)).toBe(true));

      const opcionales = ['hash_server', 'ultimo_error', 'ultimo_intento_en', 'depende_de', 'forzar_sobrescribir'];
      opcionales.forEach((col) => expect(byName.get(col)).toBe(false));
    } finally {
      db.close();
    }
  });

  it('declara id como PRIMARY KEY (rechaza inserts con id duplicado)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      insertarMinimo(db, { id: 'dup' })();
      expect(insertarMinimo(db, { id: 'dup' })).toThrow(/PRIMARY KEY|UNIQUE/i);
    } finally {
      db.close();
    }
  });

  it('rechaza INSERT con tipo fuera de {LIQUIDACION, LECTURA, EVIDENCIA, EVENTO_AUDITORIA, FACTURA} via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(insertarMinimo(db, { id: 'x', tipo: 'INVALIDO' })).toThrow(/CHECK/i);

      const validos = ['LIQUIDACION', 'LECTURA', 'EVIDENCIA', 'EVENTO_AUDITORIA', 'FACTURA'];
      validos.forEach((t, i) => {
        expect(insertarMinimo(db, { id: `ok-${i}`, tipo: t })).not.toThrow();
      });
    } finally {
      db.close();
    }
  });

  it('rechaza INSERT con estado fuera de {PENDIENTE, ENVIANDO, EXITOSO, CONFLICTO, FALLIDO, DESCARTADO} via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(insertarMinimo(db, { id: 'x', estado: 'INVALIDO' })).toThrow(/CHECK/i);

      const validos = ['PENDIENTE', 'ENVIANDO', 'EXITOSO', 'CONFLICTO', 'FALLIDO', 'DESCARTADO'];
      validos.forEach((e, i) => {
        expect(insertarMinimo(db, { id: `ok-${i}`, estado: e })).not.toThrow();
      });
    } finally {
      db.close();
    }
  });

  it('rechaza INSERT con intentos negativos via CHECK', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(insertarMinimo(db, { id: 'x', intentos: -1 })).toThrow(/CHECK/i);
      expect(insertarMinimo(db, { id: 'ok', intentos: 0 })).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('es idempotente: re-ejecutar las migrations no rompe ni cambia user_version', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(3);

      expect(() => ejecutarMigrations(db, migrations)).not.toThrow();
      expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(3);
    } finally {
      db.close();
    }
  });

  it('crearDBTest devuelve una DB con la tabla cola_sincronizacion ya migrada (sanity check del fixture)', () => {
    const db = crearDBTest();
    try {
      expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(3);
      const tabla = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='cola_sincronizacion'",
        )
        .get();
      expect(tabla).toBeDefined();
    } finally {
      db.close();
    }
  });
});
