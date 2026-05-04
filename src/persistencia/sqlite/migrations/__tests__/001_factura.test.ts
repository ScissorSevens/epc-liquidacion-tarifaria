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
});
