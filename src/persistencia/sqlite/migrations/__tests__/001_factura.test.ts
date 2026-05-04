import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';

describe('migration 001_factura — schema básico', () => {
  it('crea la tabla factura tras aplicar la migration y deja user_version=1', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      expect(db.pragma('user_version', { simple: true })).toBe(1);

      const tabla = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='factura'")
        .get();
      expect(tabla).toBeDefined();
    } finally {
      db.close();
    }
  });

  it('declara las columnas básicas (id, numero_factura, estado, fecha_emision, snapshot, hash, liquidacion_id, id_periodo, id_suscriptor, created_at)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const cols = db.prepare("PRAGMA table_info('factura')").all() as Array<{
        name: string;
      }>;
      const nombres = cols.map((c) => c.name);

      expect(nombres).toEqual(
        expect.arrayContaining([
          'id',
          'numero_factura',
          'estado',
          'fecha_emision',
          'snapshot',
          'hash',
          'liquidacion_id',
          'id_periodo',
          'id_suscriptor',
          'created_at',
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('declara las columnas opcionales de anulacion y reemplazo (motivo_anulacion, fecha_anulacion, reemplaza_a)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const cols = db.prepare("PRAGMA table_info('factura')").all() as Array<{
        name: string;
      }>;
      const nombres = new Set(cols.map((c) => c.name));

      expect(nombres.has('motivo_anulacion')).toBe(true);
      expect(nombres.has('fecha_anulacion')).toBe(true);
      expect(nombres.has('reemplaza_a')).toBe(true);
    } finally {
      db.close();
    }
  });

  it("rechaza INSERT con estado fuera de {BORRADOR, EMITIDA, PAGADA, ANULADA} via CHECK", () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      // Insertar con estado invalido — debe fallar por CHECK constraint.
      const insertarConEstadoInvalido = () =>
        db
          .prepare(
            `INSERT INTO factura (id, numero_factura, estado, fecha_emision, snapshot, hash, liquidacion_id, id_periodo, id_suscriptor, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run('id-1', 'F-001', 'INVALIDO', '2026-01-15', '{}', 'h', 'liq-1', '202601', 1, '2026-01-15');

      expect(insertarConEstadoInvalido).toThrow(/CHECK/i);

      // Y todos los estados validos deben pasar.
      const estadosValidos = ['BORRADOR', 'EMITIDA', 'PAGADA', 'ANULADA'] as const;
      estadosValidos.forEach((estado, i) => {
        expect(() =>
          db
            .prepare(
              `INSERT INTO factura (id, numero_factura, estado, fecha_emision, snapshot, hash, liquidacion_id, id_periodo, id_suscriptor, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              `id-ok-${i}`,
              `F-OK-${i}`,
              estado,
              '2026-01-15',
              '{}',
              'h',
              `liq-ok-${i}`,
              '202601',
              1,
              '2026-01-15',
            ),
        ).not.toThrow();
      });
    } finally {
      db.close();
    }
  });

  it('declara id como PRIMARY KEY (rechaza inserts con id duplicado)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const insertar = db.prepare(
        `INSERT INTO factura (id, numero_factura, estado, fecha_emision, snapshot, hash, liquidacion_id, id_periodo, id_suscriptor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      insertar.run('id-PK', 'F-1', 'EMITIDA', '2026-01-15', '{}', 'h1', 'liq-A', '202601', 1, '2026-01-15');

      // Mismo id pero distinta liquidacion → debe fallar por PRIMARY KEY.
      expect(() =>
        insertar.run('id-PK', 'F-2', 'EMITIDA', '2026-01-15', '{}', 'h2', 'liq-B', '202601', 1, '2026-01-15'),
      ).toThrow(/PRIMARY KEY|UNIQUE/i);
    } finally {
      db.close();
    }
  });

  it("declara UNIQUE PARCIAL sobre liquidacion_id WHERE estado != 'ANULADA' (D7)", () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);

      const insertar = db.prepare(
        `INSERT INTO factura (id, numero_factura, estado, fecha_emision, snapshot, hash, liquidacion_id, id_periodo, id_suscriptor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      // f1 EMITIDA con liq-X — OK.
      insertar.run('id-1', 'F-1', 'EMITIDA', '2026-01-15', '{}', 'h1', 'liq-X', '202601', 1, '2026-01-15');

      // f2 EMITIDA con la misma liq-X — debe fallar por UNIQUE parcial.
      expect(() =>
        insertar.run('id-2', 'F-2', 'EMITIDA', '2026-01-15', '{}', 'h2', 'liq-X', '202601', 1, '2026-01-15'),
      ).toThrow(/UNIQUE/i);

      // Anulamos f1 — el liq-X queda libre.
      db.prepare("UPDATE factura SET estado='ANULADA', fecha_anulacion='2026-02-01', motivo_anulacion='corrige' WHERE id='id-1'").run();

      // Ahora f2 con liq-X debe pasar (la única no-anulada con liq-X soy yo).
      expect(() =>
        insertar.run('id-2', 'F-2', 'EMITIDA', '2026-01-15', '{}', 'h2', 'liq-X', '202601', 1, '2026-01-15'),
      ).not.toThrow();

      // Y dos ANULADAS con la misma liq son admisibles (UNIQUE no aplica a anuladas).
      insertar.run('id-3', 'F-3', 'ANULADA', '2026-01-15', '{}', 'h3', 'liq-Y', '202601', 1, '2026-01-15');
      expect(() =>
        insertar.run('id-4', 'F-4', 'ANULADA', '2026-01-15', '{}', 'h4', 'liq-Y', '202601', 1, '2026-01-15'),
      ).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('declara NOT NULL en columnas criticas (numero_factura, estado, fecha_emision, snapshot, hash, liquidacion_id, id_periodo, id_suscriptor, created_at)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrations);
      const cols = db.prepare("PRAGMA table_info('factura')").all() as Array<{
        name: string;
        notnull: number;
      }>;
      const byName = new Map(cols.map((c) => [c.name, c.notnull === 1]));

      const criticas = [
        'numero_factura',
        'estado',
        'fecha_emision',
        'snapshot',
        'hash',
        'liquidacion_id',
        'id_periodo',
        'id_suscriptor',
        'created_at',
      ];
      criticas.forEach((col) => {
        expect(byName.get(col)).toBe(true);
      });

      // Las opcionales deben permitir NULL.
      ['motivo_anulacion', 'fecha_anulacion', 'reemplaza_a'].forEach((col) => {
        expect(byName.get(col)).toBe(false);
      });
    } finally {
      db.close();
    }
  });
});
