/**
 * Test E2E para reproducir el bug stale-state de ParametrosTarifa.tsx
 * cuando el bootstrap y la pantalla admin usan formatos diferentes para
 * `vigente_desde`.
 *
 * ## El bug
 *
 * `bootstrap-completo.ts:201` calcula `fecha_vigencia_desde = ahora.toISOString()`
 * → guarda como full ISO: `'2026-08-10T18:30:00.000Z'` (24 chars).
 *
 * `ParametrosTarifa.tsx:325` hidrata el form con `vigente_desde.slice(0, 10)`
 * → convierte a date-only: `'2026-08-10'` (10 chars).
 *
 * Cuando el usuario edita y guarda sin tocar `vigente_desde`,
 * `buildBorradorLocal` pasa `form.vigenteDesde = '2026-08-10'` (date-only).
 *
 * El UPSERT en `parametros-tarifa-repository-expo-sqlite.ts:285` usa la
 * triple clave `(id_prestador, periodo, vigente_desde)`:
 *   DB tiene: `'2026-08-10T18:30:00.000Z'`
 *   Save pasa: `'2026-08-10'`
 *   → NO MATCH → INSERT nueva fila (en lugar de UPDATE).
 *
 * Después del save la DB tiene 2 filas para el mismo prestador.
 * `buscarVigente` con `ORDER BY vigente_desde DESC LIMIT 1` devuelve la del
 * bootstrap (`'2026-08-10T18:30:00.000Z'` > `'2026-08-10'` lexicográficamente).
 *
 * Resultado: pantalla muestra el valor viejo del bootstrap, no el recién guardado.
 *
 * ## Qué prueba este test
 *
 * Reproduce el flujo completo con SQLite real (no mocks):
 *   1. Bootstrap crea fila con `vigente_desde` full ISO (simulado via INSERT directo).
 *   2. Screen lee via `buscarVigente` → toma la fila del bootstrap.
 *   3. Screen hace `guardar` con `vigente_desde` date-only (como realmente hace el form).
 *   4. Assert: SOLO debe haber UNA fila en DB, con el cma actualizado.
 *
 * Si hay 2 filas → el bug está reproducido → UPSERT NO matcheó.
 *
 * ## RED phase
 *
 * Este test fue escrito ANTES del fix. Inicialmente FALLA con:
 *   - DB tiene 2 filas
 *   - La fila del bootstrap sigue con `cma = 5_000_000` (viejo)
 *   - La fila nueva tiene `cma = 4_000_000` pero `vigente_desde = '2026-08-10'`
 *
 * ## GREEN phase
 *
 * El fix preserva el formato original de `vigente_desde` cuando el usuario
 * NO editó el campo. Después del fix:
 *   - DB tiene 1 fila
 *   - La fila tiene `cma = 4_000_000` y `vigente_desde = '2026-08-10T18:30:00.000Z'`
 *   - `buscarVigente` retorna la misma fila (mismo `id_parametros`)
 */

import Database from 'better-sqlite3';

interface ExpoLikeDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

let mockExpoDb: ExpoLikeDb;

jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(async () => mockExpoDb),
}));

import { bootstrapApp, type BootstrapApp } from '../../../composition/bootstrap';
import { crearParametrosTarifaRepositoryExpoSqlite } from '../parametros-tarifa-repository-expo-sqlite';
import {
  buildBorradorLocal,
  type FormValues,
} from '../../../pantallas/admin/parametros-tarifa-build-borrador';

function createExpoLikeDb(rawDb: Database.Database): ExpoLikeDb {
  return {
    async execAsync(sql) { rawDb.exec(sql); },
    async runAsync(sql, ...params) {
      const result = rawDb.prepare(sql).run(...params);
      return { lastInsertRowId: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0), changes: result.changes };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return rawDb.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      return (rawDb.prepare(sql).get(...params) ?? null) as T | null;
    },
    async withTransactionAsync(task) {
      rawDb.exec('BEGIN');
      try { await task(); rawDb.exec('COMMIT'); }
      catch (error) { rawDb.exec('ROLLBACK'); throw error; }
    },
    async closeAsync() { rawDb.close(); },
  };
}

describe('ParametrosTarifa UPSERT — vigente_desde format mismatch (bug stale-state)', () => {
  let rawDb: Database.Database;
  let app: BootstrapApp;

  beforeEach(async () => {
    rawDb = new Database(':memory:');
    rawDb.pragma('foreign_keys = ON');
    mockExpoDb = createExpoLikeDb(rawDb);
    app = await bootstrapApp();
  });

  afterEach(async () => {
    await app.db.closeAsync();
  });

  it('T-PARAM-STALE-PERSIST: save con date-only NO crea fila duplicada cuando bootstrap uso full ISO', async () => {
    // ── Setup ──────────────────────────────────────────────────────
    // 1. Setup mínimo: crear prestador + acuerdo directo en DB (sin
    //    bootstrapCompleto porque ese path tiene problemas con la
    //    transacción en mockDb — irrelevante para este test). Solo
    //    necesitamos una fila en `parametros_tarifa` con formato
    //    full ISO (como lo haría el bootstrap en producción).
    rawDb
      .prepare(`INSERT INTO prestador (
        id_prestador, codigo, nombre, nit, municipio, departamento, segmento,
        num_suscriptores_urbanos, num_suscriptores_rurales, contacto, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(1, '0001', 'Test', '900', 'M', 'D', 2, 0, 15, null, 'activo');

    rawDb
      .prepare(`INSERT INTO acuerdo_municipal (
        id_acuerdo, id_prestador,
        factor_subsidio_e1, factor_subsidio_e2, factor_subsidio_e3,
        factor_contribucion_e5, factor_contribucion_e6,
        fecha_vigencia_desde, fecha_vigencia_hasta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(100, 1, -0.6, -0.5, -0.4, 0.5, 0.6,
           '2026-01-01', '2030-12-31');

    // 2. Simular lo que hace bootstrapCompleto: insertar la fila de
    //    parametros_tarifa con vigente_desde = full ISO.
    rawDb
      .prepare(`INSERT INTO parametros_tarifa (
        id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt, cmviaa, aplica_cmviaa,
        agua_suministrada_m3_anio, ipuf_m3_suscriptor_mes, suscriptores_promedio,
        aplica_minimo_vital, m3_gratis_minimo_vital, ipuf_indice,
        cargo_fijo_resultante, cargo_consumo_resultante, componentes_aplicables,
        vigente_desde, vigente_hasta, anio_base, factor_indexacion_ipc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(1, 100, 2026, 5_000_000, 500, 200, 100, 0, 0,
           50_000, 6, 1000, 0, 0, 1.0,
           5_000, 850, '["CMA","CMO","CMI","CMT"]',
           '2026-08-10T18:30:00.000Z', '2030-12-31T00:00:00.000Z',
           2016, 1.0);

    // 3. Verificar que el setup es correcto: 1 fila con full ISO.
    const rowsIniciales = rawDb
      .prepare('SELECT id_parametros, vigente_desde, cma FROM parametros_tarifa WHERE id_prestador = ?')
      .all(1) as Array<{ id_parametros: number; vigente_desde: string; cma: number }>;

    expect(rowsIniciales).toHaveLength(1);
    const idOriginal = rowsIniciales[0].id_parametros;
    expect(rowsIniciales[0].vigente_desde).toBe('2026-08-10T18:30:00.000Z'); // full ISO
    expect(rowsIniciales[0].cma).toBe(5_000_000);

    // ── Act ────────────────────────────────────────────────────────
    // 4. Simular lo que hace la pantalla admin:
    //    a) Lee la fila via buscarVigente (con fecha actual full ISO).
    const repo = crearParametrosTarifaRepositoryExpoSqlite(app.db);
    const paramsLeidos = await repo.buscarVigente(1, '2026-08-10T19:00:00.000Z');
    expect(paramsLeidos).not.toBeNull();
    expect(paramsLeidos!.id_parametros).toBe(idOriginal);

    //    b) El screen hace .slice(0, 10) sobre vigente_desde para el form.
    //       Esto simula exactamente lo que hace ParametrosTarifa.tsx:325.
    const vigente_desdeFormValue = paramsLeidos!.vigente_desde.slice(0, 10);
    expect(vigente_desdeFormValue).toBe('2026-08-10'); // confirmamos que es date-only

    //    c) El usuario edita cma (no toca vigente_desde) y guarda.
    //       El form pasa `vigente_desde = '2026-08-10'` (date-only).
    //       El helper `buildBorradorLocal` con `vigenteDesdePersistido`
    //       preserva el formato full ISO cuando el usuario no editó la fecha.
    const cmaNuevo = 4_000_000;
    const formValues: FormValues = {
      periodo: String(paramsLeidos!.periodo),
      anioBase: String(paramsLeidos!.anio_base),
      cma: String(cmaNuevo),
      cmo: String(paramsLeidos!.cmo),
      cmi: String(paramsLeidos!.cmi),
      cmt: String(paramsLeidos!.cmt),
      cmviaa: String(paramsLeidos!.cmviaa),
      cmaa: String(paramsLeidos!.cmaa ?? 0),
      aplicaCmviaa: paramsLeidos!.aplica_cmviaa,
      // Phase 2 task 2.4 (GREEN): flag explicito CMAA. Default false
      // para data legacy pre-Phase 2 (el campo es opcional en el
      // domain type ParametrosTarifa).
      aplicaCmaa: paramsLeidos!.aplica_cmaa ?? false,
      actoAdopcion: paramsLeidos!.acto_adopcion ?? '',
      estudioCostosId: paramsLeidos!.estudio_costos_id ?? '',
      documentoSoporteUrl: paramsLeidos!.documento_soporte_url ?? '',
      aguaSuministrada: String(paramsLeidos!.agua_suministrada_m3_anio),
      ipuf: String(paramsLeidos!.ipuf_m3_suscriptor_mes),
      suscriptoresPromedio: String(paramsLeidos!.suscriptores_promedio),
      // Phase 3 task 3.2 (GREEN) — Opción A: `aplicaMinimoVital` y
      // `m3Gratis` se ELIMINARON del FormValues. El buildBorradorLocal
      // los hardcodea a `false`/`0` (la fuente de verdad del mínimo
      // vital es la tabla separada `minimo_vital`).
      vigenteDesde: vigente_desdeFormValue, // date-only como lo ve el form
      vigenteHasta: paramsLeidos!.vigente_hasta.slice(0, 10),
      altitud: String(paramsLeidos!.altitud_msnm ?? 0),
    };
    const borrador = buildBorradorLocal(formValues, {
      id_prestador: 1,
      id_acuerdo: 100,
      vigenteDesdePersistido: paramsLeidos!.vigente_desde, // full ISO preservado
    });
    expect(borrador.vigente_desde).toBe('2026-08-10T18:30:00.000Z'); // FIX: helper preserva formato

    const persisted = await repo.guardar({
      ...borrador,
      id_prestador: 1,
      id_acuerdo: 100,
      cargo_fijo_resultante: cmaNuevo,
      cargo_consumo_resultante: 850,
    });

    // ── Assert ─────────────────────────────────────────────────────
    // 5. Esperado: el UPSERT matchea la fila existente y la ACTUALIZA.
    //   - Sigue habiendo UNA sola fila.
    //   - El id_parametros NO cambia.
    //   - El cma se actualizo a 4_000_000.
    const rowsFinales = rawDb
      .prepare('SELECT id_parametros, vigente_desde, cma FROM parametros_tarifa WHERE id_prestador = ?')
      .all(1) as Array<{ id_parametros: number; vigente_desde: string; cma: number }>;

    expect(rowsFinales).toHaveLength(1); // ← ESTE ES EL ASSERT CLAVE: solo UNA fila
    expect(rowsFinales[0].id_parametros).toBe(idOriginal); // mismo id
    expect(rowsFinales[0].cma).toBe(cmaNuevo); // valor actualizado
    expect(rowsFinales[0].vigente_desde).toBe('2026-08-10T18:30:00.000Z'); // formato full ISO preservado

    // Adicional: persistido retornado matchea DB
    expect(persisted.id_parametros).toBe(idOriginal);
    expect(persisted.cma).toBe(cmaNuevo);

    // Adicional: buscarVigente post-save retorna la misma fila actualizada
    const postSave = await repo.buscarVigente(1, '2026-08-10T19:00:00.000Z');
    expect(postSave?.id_parametros).toBe(idOriginal);
    expect(postSave?.cma).toBe(cmaNuevo);
  });
});
