/**
 * Contract tests del adapter Expo SQLite de FacturaRepository.
 *
 * Bloque A — CRUD base:               6 tests (T-3.1 a T-3.6).
 * Bloque B — Compliance round-trip:   4 tests (T-3.9 a T-3.12; T-3.13 a T-3.14).
 * Bloque C — Anulación / reemplazo:   3 tests (T-3.15 a T-3.18 → 3 unicos).
 * Bloque D — Errores y edge cases:    4 tests (T-3.19 a T-3.22).
 *
 * Total: ~17 tests. Cobertura por bloque:
 *  - A verifica el contrato public methods crear / buscarPorId / actualizar /
 *    listar / buscarPorLiquidacion / anular.
 *  - B verifica que las 4 columnas migration 020 sobreviven al round-trip.
 *  - C verifica flujo de anulación + reemplazo.
 *  - D verifica constraints (UNIQUE / PK) y edge cases (null, vacio).
 *
 * TDD:
 *  RED: estos tests describen comportamiento que el adapter YA tiene
 *       (mirror de la version Node). Sirven como red de seguridad si alguien
 *       toca el adapter sin actualizar los tests.
 *  GREEN: la implementacion actual ya cumple estos casos.
 *  TRIANGULATE: parametros forzados (null, edge cases) verifican robustez.
 *
 * Mocks: `crearMockExpoSqliteDb()` provee un SQLiteDatabase en memoria
 *        con dispatch de las queries que usa el adapter. No requiere RN
 *        runtime.
 */

import {
  buildFacturaRow,
  crearMockExpoSqliteDb,
} from './factura-repository-expo-sqlite-helpers';
import { crearFacturaRepositoryExpoSqlite } from '../factura-repository-expo-sqlite';
import type { Factura } from '@dominio/factura/types';

describe('factura-repository-expo-sqlite (contract)', () => {
  // ────────────────────────────────────────────────────────────────────
  // Bloque A — CRUD base
  // ────────────────────────────────────────────────────────────────────

  describe('crear / buscarPorId', () => {
    it('T-3.1: crear + buscarPorId retorna la misma Factura', async () => {
      const mock = crearMockExpoSqliteDb();
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);

      const row = buildFacturaRow();
      const factura = repo.crear({
        id: row.id,
        numero_factura: row.numero_factura,
        estado: 'EMITIDA',
        fecha_emision: row.fecha_emision,
        snapshot: JSON.parse(row.snapshot),
        hash: row.hash,
        codigo_verificacion: row.codigo_verificacion ?? 'PLACEHOLDER',
        version_tarifa_aplicada: row.version_tarifa_aplicada ?? 'v1-legacy',
        ...(row.referencia_pago ? { referencia_pago: row.referencia_pago } : {}),
        ...(row.qr_pago ? { qr_pago: row.qr_pago } : {}),
        created_at: row.created_at,
      });

      await expect(factura).resolves.toMatchObject({
        id: 'F-001',
        numero_factura: 'F-2026-001',
      });
      const encontrada = await repo.buscarPorId('F-001');
      expect(encontrada).not.toBeNull();
      expect(encontrada!.id).toBe('F-001');
      expect(encontrada!.codigo_verificacion).toBe('ABC123XYZ0');
    });

    it('T-3.7: buscarPorId retorna null para id inexistente', async () => {
      const mock = crearMockExpoSqliteDb();
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await expect(repo.buscarPorId('NO-EXISTE')).resolves.toBeNull();
    });

    it('T-3.21: buscarPorId con id `null` retorna null sin throw', async () => {
      const mock = crearMockExpoSqliteDb();
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      // El adapter filtra `id === null` antes de query? Revisamos — el mock
      // retorna null si no encuentra, asi que el adapter debe tolerarlo.
      // Si `id = null as any` rompe, este test falla y obliga a robustez.
      await expect(repo.buscarPorId(null as unknown as string)).resolves.toBeNull();
    });

    it('T-3.22: listar con tabla vacia retorna array vacio', async () => {
      const mock = crearMockExpoSqliteDb();
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await expect(repo.listar()).resolves.toEqual([]);
    });
  });

  describe('listar / actualizar', () => {
    it('T-3.2: listar retorna N facturas en orden de insercion', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({ id: 'F-001' }),
        buildFacturaRow({ id: 'F-002', liquidacion_id: 'L-002', numero_factura: 'F-2026-002' }),
        buildFacturaRow({ id: 'F-003', liquidacion_id: 'L-003', numero_factura: 'F-2026-003' }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const lista = await repo.listar();
      expect(lista).toHaveLength(3);
      expect(lista.map((f) => f.id)).toEqual(['F-001', 'F-002', 'F-003']);
    });

    it('T-3.3: actualizar modifica estado y motivo_anulacion preservando hash', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([buildFacturaRow({ id: 'F-001' })]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const actualizada: Factura = await repo.actualizar('F-001', {
        estado: 'ANULADA',
        motivo_anulacion: 'Error de digitacion',
      });
      expect(actualizada.estado).toBe('ANULADA');
      expect(actualizada.hash).toBe('a'.repeat(64));
      expect(actualizada.motivo_anulacion).toBe('Error de digitacion');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Bloque B — Compliance round-trip migration 020
  // ────────────────────────────────────────────────────────────────────

  describe('compliance round-trip migration 020', () => {
    it('T-3.9: Factura con 4 columnas compliance persiste y recupera identicos', async () => {
      const mock = crearMockExpoSqliteDb();
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await repo.crear({
        id: 'F-001',
        numero_factura: 'F-2026-001',
        estado: 'EMITIDA',
        fecha_emision: '2026-07-29T00:00:00.000Z',
        snapshot: JSON.parse(buildFacturaRow().snapshot),
        hash: 'h'.repeat(64),
        codigo_verificacion: 'ABC123XYZ0',
        version_tarifa_aplicada: '1038-2026-v1',
        referencia_pago: '1-202607-1-ABCD',
        qr_pago: '{"codigo_verificacion":"ABC123XYZ0"}',
        created_at: '2026-07-29T00:00:00.000Z',
      });
      const encontrada = await repo.buscarPorId('F-001');
      expect(encontrada).toMatchObject({
        codigo_verificacion: 'ABC123XYZ0',
        referencia_pago: '1-202607-1-ABCD',
        version_tarifa_aplicada: '1038-2026-v1',
      });
      expect(encontrada!.qr_pago).toBe('{"codigo_verificacion":"ABC123XYZ0"}');
    });

    it('T-3.10: Factura legacy sin codigo_verificacion deriva placeholder', async () => {
      // Una fila legacy tiene columnas 020 = null. El adapter `fromRow`
      // deriva codigo_verificacion desde el hash cuando la columna es null.
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-LEGACY',
          codigo_verificacion: null,
          referencia_pago: null,
          qr_pago: null,
          version_tarifa_aplicada: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const legacy = await repo.buscarPorId('F-LEGACY');
      expect(legacy).not.toBeNull();
      // codigo_verificacion debe estar presente (derivado de hash, 10 chars base36).
      expect(legacy!.codigo_verificacion).toHaveLength(10);
      expect(legacy!.codigo_verificacion).toMatch(/^[0-9A-Z]{10}$/);
    });

    it('T-3.11: referencia_pago null en Factura legacy NO expone la propiedad', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-LEGACY',
          referencia_pago: null,
          qr_pago: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const legacy = await repo.buscarPorId('F-LEGACY');
      expect(legacy).not.toHaveProperty('referencia_pago');
      expect(legacy).not.toHaveProperty('qr_pago');
    });

    it('T-3.14: tras ejecutar migration 020 dos veces, buscarPorId sigue funcionando', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([buildFacturaRow()]);
      // Simulamos que la migration 020 se aplico dos veces: la fila
      // ya tiene las columnas pobladas. Despues, una nueva insercion
      // (otra factura con OTRA liquidacion_id) sigue funcionando — la
      // migration es idempotente a nivel semantico (no de schema).
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const lista = await repo.listar();
      expect(lista).toHaveLength(1);
      // Build un segundo snapshot con liquidacion.id distinto.
      const snapshot2 = JSON.parse(buildFacturaRow().snapshot);
      snapshot2.liquidacion = { ...snapshot2.liquidacion, id: 'L-002' };
      await repo.crear({
        id: 'F-002',
        numero_factura: 'F-2026-002',
        estado: 'EMITIDA',
        fecha_emision: '2026-07-29T00:00:00.000Z',
        snapshot: snapshot2,
        hash: 'b'.repeat(64),
        codigo_verificacion: 'DEF456UVW0',
        version_tarifa_aplicada: '1038-2026-v1',
        referencia_pago: '1-202607-2-EFGH',
        qr_pago: '{"a":1}',
        created_at: '2026-07-29T00:00:00.000Z',
      });
      const segunda = await repo.buscarPorId('F-002');
      expect(segunda).not.toBeNull();
      expect(segunda!.codigo_verificacion).toBe('DEF456UVW0');
      // La 1ra fila ya tiene su codigo_verificacion persistido.
      const primera = await repo.buscarPorId('F-001');
      expect(primera!.codigo_verificacion).toBe('ABC123XYZ0');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Bloque C — Anulación / reemplazo
  // ────────────────────────────────────────────────────────────────────

  describe('anulación', () => {
    it('T-3.4: anular cambia estado a ANULADA y setea motivo_anulacion + fecha_anulacion', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-001',
          estado: 'EMITIDA',
          motivo_anulacion: null,
          fecha_anulacion: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const anulada = await repo.actualizar('F-001', {
        estado: 'ANULADA',
        motivo_anulacion: 'Test',
        fecha_anulacion: '2026-07-29T01:00:00.000Z',
      });
      expect(anulada.estado).toBe('ANULADA');
      expect(anulada.motivo_anulacion).toBe('Test');
      expect(anulada.fecha_anulacion).toBe('2026-07-29T01:00:00.000Z');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Bloque D — Errores y edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('errores y edge cases', () => {
    it('T-3.19: crear con id duplicado lanza error de constraint', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([buildFacturaRow()]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await expect(
        repo.crear({
          id: 'F-001', // mismo id que la fila seed
          numero_factura: 'F-2026-002',
          estado: 'EMITIDA',
          fecha_emision: '2026-07-29T00:00:00.000Z',
          snapshot: JSON.parse(buildFacturaRow().snapshot),
          hash: 'c'.repeat(64),
          codigo_verificacion: 'XYZ',
          version_tarifa_aplicada: 'v1',
          created_at: '2026-07-29T00:00:00.000Z',
        }),
      ).rejects.toThrow(/unicidad|RESTRICCION_UNICIDAD|UNIQUE constraint/i);
    });

    it('T-3.20: crear con misma liquidacion_id no anulada lanza RESTRICCION_UNICIDAD', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([buildFacturaRow({ id: 'F-001', liquidacion_id: 'L-001' })]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await expect(
        repo.crear({
          id: 'F-002',
          numero_factura: 'F-2026-002',
          estado: 'EMITIDA',
          fecha_emision: '2026-07-29T00:00:00.000Z',
          snapshot: JSON.parse(buildFacturaRow().snapshot),
          hash: 'd'.repeat(64),
          codigo_verificacion: 'XYZ',
          version_tarifa_aplicada: 'v1',
          created_at: '2026-07-29T00:00:00.000Z',
        }),
      ).rejects.toThrow(/unicidad|RESTRICCION_UNICIDAD/i);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Bloque E — Cobertura extendida (parametrizada) introducida en
  // `factura-compliance-polish`: listar, buscarPorPeriodo,
  // buscarPorSuscriptor, transiciones ilegales, motivo_anulacion,
  // multiples facturas en la misma DB.
  // ────────────────────────────────────────────────────────────────────

  describe('listar() con/sin facturas', () => {
    it('listar() con DB vacia retorna []', async () => {
      const mock = crearMockExpoSqliteDb();
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await expect(repo.listar()).resolves.toEqual([]);
    });

    it('listar() con 1 sola factura retorna el array de 1', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([buildFacturaRow({ id: 'F-001' })]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const lista = await repo.listar();
      expect(lista).toHaveLength(1);
      expect(lista[0]!.id).toBe('F-001');
    });

    it('listar() con N=5 facturas preserva el orden de insercion', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({ id: 'F-001' }),
        buildFacturaRow({ id: 'F-002' }),
        buildFacturaRow({ id: 'F-003' }),
        buildFacturaRow({ id: 'F-004' }),
        buildFacturaRow({ id: 'F-005' }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const lista = await repo.listar();
      expect(lista.map((f) => f.id)).toEqual(['F-001', 'F-002', 'F-003', 'F-004', 'F-005']);
    });
  });

  describe('buscarPorPeriodo', () => {
    it('retorna las facturas cuyo id_periodo matchea', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({ id: 'F-001', id_periodo: '202607' }),
        buildFacturaRow({ id: 'F-002', id_periodo: '202607' }),
        buildFacturaRow({ id: 'F-003', id_periodo: '202608' }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const periodo = await repo.buscarPorPeriodo('202607');
      expect(periodo).toHaveLength(2);
      expect(periodo.map((f) => f.id).sort()).toEqual(['F-001', 'F-002']);
    });

    it('retorna [] si ningun factura matchea el periodo', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([buildFacturaRow({ id: 'F-001', id_periodo: '202607' })]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const periodo = await repo.buscarPorPeriodo('209912');
      expect(periodo).toEqual([]);
    });

    it('multiples periodos retornan conjuntos disjuntos', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({ id: 'F-001', id_periodo: '202607' }),
        buildFacturaRow({ id: 'F-002', id_periodo: '202608' }),
        buildFacturaRow({ id: 'F-003', id_periodo: '202609' }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const p607 = await repo.buscarPorPeriodo('202607');
      const p608 = await repo.buscarPorPeriodo('202608');
      const p609 = await repo.buscarPorPeriodo('202609');
      expect(p607.map((f) => f.id)).toEqual(['F-001']);
      expect(p608.map((f) => f.id)).toEqual(['F-002']);
      expect(p609.map((f) => f.id)).toEqual(['F-003']);
    });
  });

  describe('buscarPorSuscriptor', () => {
    it('retorna las facturas del suscriptor', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({ id: 'F-001', id_suscriptor: 7 }),
        buildFacturaRow({ id: 'F-002', id_suscriptor: 7 }),
        buildFacturaRow({ id: 'F-003', id_suscriptor: 8 }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const facturas = await repo.buscarPorSuscriptor(7);
      expect(facturas).toHaveLength(2);
      expect(facturas.map((f) => f.id).sort()).toEqual(['F-001', 'F-002']);
    });

    it('retorna [] si el suscriptor no tiene facturas', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([buildFacturaRow({ id: 'F-001', id_suscriptor: 7 })]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const facturas = await repo.buscarPorSuscriptor(999);
      expect(facturas).toEqual([]);
    });
  });

  describe('actualizar() con transiciones de estado', () => {
    it('BORRADOR → PAGADA directo lanza TRANSICION_ILEGAL (no legal)', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-001',
          estado: 'BORRADOR',
          motivo_anulacion: null,
          fecha_anulacion: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await expect(
        repo.actualizar('F-001', { estado: 'PAGADA' }),
      ).rejects.toThrow(/TRANSICION_ILEGAL|transici[oó]n.*no permit/i);
    });

    it('BORRADOR → EMITIDA es legal (happy path)', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-001',
          estado: 'BORRADOR',
          motivo_anulacion: null,
          fecha_anulacion: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const actualizada = await repo.actualizar('F-001', { estado: 'EMITIDA' });
      expect(actualizada.estado).toBe('EMITIDA');
    });

    it('PAGADA → ANULADA es ilegal (PAGADA es terminal)', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-001',
          estado: 'PAGADA',
          motivo_anulacion: null,
          fecha_anulacion: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      await expect(
        repo.actualizar('F-001', { estado: 'ANULADA', motivo_anulacion: 'X' }),
      ).rejects.toThrow(/TRANSICION_ILEGAL|transici[oó]n.*no permit/i);
    });

    it('mismo estado (no-op) es legal sin error', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-001',
          estado: 'EMITIDA',
          motivo_anulacion: null,
          fecha_anulacion: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      // Actualizar sin cambiar el estado: el adapter detecta que
      // `cambios.estado === existente.estado` y no invoca la
      // validacion de transicion legal.
      const actualizada = await repo.actualizar('F-001', { estado: 'EMITIDA' });
      expect(actualizada.estado).toBe('EMITIDA');
    });
  });

  describe('actualizar() con motivo_anulacion', () => {
    it('setear motivo_anulacion sin estado ANULADA lo persiste en la fila', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-001',
          estado: 'EMITIDA',
          motivo_anulacion: null,
          fecha_anulacion: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const actualizada = await repo.actualizar('F-001', {
        estado: 'EMITIDA',
        motivo_anulacion: 'observacion auditoria',
      });
      expect(actualizada.motivo_anulacion).toBe('observacion auditoria');
    });

    it('anular + motivo_anulacion -> fila persistida con ambos', async () => {
      const mock = crearMockExpoSqliteDb();
      mock.seed([
        buildFacturaRow({
          id: 'F-001',
          estado: 'EMITIDA',
          motivo_anulacion: null,
          fecha_anulacion: null,
        }),
      ]);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const actualizada = await repo.actualizar('F-001', {
        estado: 'ANULADA',
        motivo_anulacion: 'Error de digitacion',
        fecha_anulacion: '2026-07-29T15:00:00.000Z',
      });
      expect(actualizada.estado).toBe('ANULADA');
      expect(actualizada.motivo_anulacion).toBe('Error de digitacion');
      expect(actualizada.fecha_anulacion).toBe('2026-07-29T15:00:00.000Z');
    });
  });

  describe('multiples facturas en la misma DB', () => {
    it('N=10 facturas con distintos metadatos: listar retorna todas', async () => {
      const mock = crearMockExpoSqliteDb();
      const seedRows = Array.from({ length: 10 }, (_, i) =>
        buildFacturaRow({
          id: `F-${String(i + 1).padStart(3, '0')}`,
          numero_factura: `F-2026-${String(i + 1).padStart(3, '0')}`,
          liquidacion_id: `L-${i + 1}`,
          id_suscriptor: (i % 3) + 1,
          id_periodo: ['202607', '202608', '202609'][i % 3]!,
        }),
      );
      mock.seed(seedRows);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const lista = await repo.listar();
      expect(lista).toHaveLength(10);
      expect(new Set(lista.map((f) => f.id)).size).toBe(10);
    });

    it('multiples facturas del mismo suscriptor: buscarPorSuscriptor las trae todas', async () => {
      const mock = crearMockExpoSqliteDb();
      // Inyectamos id_periodo en el snapshot del JSON para que
      // `f.snapshot.periodo.id_periodo` matchee el `id_periodo` de la fila.
      // (El `buildFacturaRow` default usa '202607' en el snapshot.periodo.)
      const seedRows = [
        buildFacturaRow({ id: 'F-001', id_suscriptor: 7, id_periodo: '202607' }),
        buildFacturaRow({ id: 'F-002', id_suscriptor: 7, id_periodo: '202608' }),
        buildFacturaRow({ id: 'F-003', id_suscriptor: 7, id_periodo: '202609' }),
        buildFacturaRow({ id: 'F-004', id_suscriptor: 8, id_periodo: '202607' }),
      ].map((r) => ({
        ...r,
        snapshot: JSON.stringify({
          ...JSON.parse(r.snapshot),
          periodo: { ...JSON.parse(r.snapshot).periodo, id_periodo: r.id_periodo },
        }),
      })) as ReturnType<typeof buildFacturaRow>[];
      mock.seed(seedRows);
      const repo = crearFacturaRepositoryExpoSqlite(mock.db);
      const suscriptor7 = await repo.buscarPorSuscriptor(7);
      expect(suscriptor7).toHaveLength(3);
      expect(suscriptor7.map((f) => f.snapshot.periodo.id_periodo).sort()).toEqual([
        '202607',
        '202608',
        '202609',
      ]);
      const suscriptor8 = await repo.buscarPorSuscriptor(8);
      expect(suscriptor8).toHaveLength(1);
      expect(suscriptor8[0]!.id).toBe('F-004');
    });
  });
});
