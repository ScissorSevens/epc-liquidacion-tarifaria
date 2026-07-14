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
  id_prestador: number;
  numero_cedula: string;
  nombre: string;
  email: string;
  password_hash: string;
  rol: string;
  estado: string;
  dispositivo_id: string | null;
  created_at: string | null;
}> = {}) {
  return {
    id_operario: 1,
    id_prestador: 1,
    numero_cedula: '123',
    nombre: 'Ana',
    email: 'ana@test.com',
    password_hash: '',
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
  runAsync?: jest.Mock;
} = {}) {
  return {
    execAsync: overrides.execAsync ?? jest.fn().mockResolvedValue(undefined),
    getAllAsync: overrides.getAllAsync ?? jest.fn().mockResolvedValue([]),
    getFirstAsync: overrides.getFirstAsync ?? jest.fn().mockResolvedValue(null),
    runAsync: overrides.runAsync ?? jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 0 }),
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
      id_prestador: 1,
      nombre: 'Carlos',
      numero_cedula: '999',
      email: 'carlos@test.com',
      password_hash: '',
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

// ── buscarPorId ──────────────────────────────────────────────────────────────────

describe('buscarPorId()', () => {
  it('retorna operario cuando existe', async () => {
    const row = buildRow({ id_operario: 42, numero_cedula: '888', id_prestador: 5 });
    const getFirstAsync = jest.fn().mockResolvedValue(row);
    const db = buildDb({ getFirstAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorId(42);

    expect(getFirstAsync).toHaveBeenCalledWith(expect.stringMatching(/WHERE id_operario\s*=\s*\?/i), 42);
    expect(resultado).not.toBeNull();
    expect(resultado!.id_operario).toBe(42);
    expect(resultado!.id_prestador).toBe(5);
  });

  it('retorna null cuando no existe', async () => {
    const db = buildDb({ getFirstAsync: jest.fn().mockResolvedValue(null) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorId(999);

    expect(resultado).toBeNull();
  });
});

// ── buscarPorCedula ──────────────────────────────────────────────────────────────

describe('buscarPorCedula()', () => {
  it('retorna operario cuando existe la cédula', async () => {
    const row = buildRow({ id_operario: 3, numero_cedula: '51800012', id_prestador: 1 });
    const getFirstAsync = jest.fn().mockResolvedValue(row);
    const db = buildDb({ getFirstAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorCedula('51800012');

    expect(getFirstAsync).toHaveBeenCalledWith(expect.stringMatching(/WHERE numero_cedula\s*=\s*\?/i), '51800012');
    expect(resultado).not.toBeNull();
    expect(resultado!.numero_cedula).toBe('51800012');
  });

  it('retorna null cuando la cédula no existe', async () => {
    const db = buildDb({ getFirstAsync: jest.fn().mockResolvedValue(null) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorCedula('00000000');

    expect(resultado).toBeNull();
  });
});

// ── buscarPorDispositivo (compuesto) ────────────────────────────────────────────

describe('buscarPorDispositivo() — compuesto por dispositivo_id + id_prestador', () => {
  it('retorna operario cuando dispositivo_id y id_prestador coinciden', async () => {
    const row = buildRow({
      id_operario: 11,
      id_prestador: 7,
      dispositivo_id: 'tablet-99',
    });
    const getFirstAsync = jest.fn().mockResolvedValue(row);
    const db = buildDb({ getFirstAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorDispositivo('tablet-99', 7);

    expect(getFirstAsync).toHaveBeenCalledTimes(1);
    const [sql, ...params] = getFirstAsync.mock.calls[0];
    expect(sql).toMatch(/WHERE\s+dispositivo_id\s*=\s*\?/i);
    expect(sql).toMatch(/AND\s+id_prestador\s*=\s*\?/i);
    expect(params).toEqual(['tablet-99', 7]);
    expect(resultado).not.toBeNull();
    expect(resultado!.id_prestador).toBe(7);
  });

  it('retorna null cuando no hay match del par (dispositivoId, idPrestador)', async () => {
    const db = buildDb({ getFirstAsync: jest.fn().mockResolvedValue(null) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.buscarPorDispositivo('tablet-99', 999);

    expect(resultado).toBeNull();
  });
});

// ── actualizar ───────────────────────────────────────────────────────────────────

describe('actualizar()', () => {
  it('ejecuta UPDATE con la cláusula WHERE id_operario = ?', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
    const getFirstAsync = jest.fn().mockResolvedValue(
      buildRow({ id_operario: 7, estado: 'inactivo' }),
    );
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    await repo.actualizar(7, { estado: 'inactivo' });

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, ..._params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/UPDATE\s+operarios/i);
    expect(sql).toMatch(/SET/i);
    expect(sql).toMatch(/WHERE\s+id_operario\s*=\s*\?/i);
  });

  it('lee el operario actualizado y lo retorna', async () => {
    const filaActualizada = buildRow({ id_operario: 7, estado: 'inactivo', dispositivo_id: null });
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
    const getFirstAsync = jest.fn().mockResolvedValue(filaActualizada);
    const db = buildDb({ runAsync, getFirstAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.actualizar(7, { estado: 'inactivo' });

    expect(resultado).not.toBeNull();
    expect(resultado.estado).toBe('inactivo');
  });
});

// ── listarPorPrestador ───────────────────────────────────────────────────────────

describe('listarPorPrestador()', () => {
  it('filtra por id_prestador en la cláusula WHERE', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    const db = buildDb({ getAllAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.listarPorPrestador(5);

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, ...params] = getAllAsync.mock.calls[0];
    expect(sql).toMatch(/WHERE\s+id_prestador\s*=\s*\?/i);
    expect(params).toEqual([5]);
    expect(resultado).toEqual([]);
  });

  it('retorna lista mapeada de operarios del prestador', async () => {
    const filas = [
      buildRow({ id_operario: 1, id_prestador: 5, numero_cedula: '111', nombre: 'Ana' }),
      buildRow({ id_operario: 2, id_prestador: 5, numero_cedula: '222', nombre: 'Luis' }),
    ];
    const db = buildDb({ getAllAsync: jest.fn().mockResolvedValue(filas) });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    const resultado = await repo.listarPorPrestador(5);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].id_prestador).toBe(5);
    expect(resultado[1].id_prestador).toBe(5);
  });
});

// ── eliminarPorCedula ─────────────────────────────────────────────────────────
//
// TICKET-EPIC-LOGIN-001 — Fase 4 Tarea 4.3.2:
// Necesitamos borrar operarios con cedula legacy ('placeholder') introducidos
// por el bypass viejo de Configuracion.tsx (ya eliminado en 4.3.1). El helper
// `limpiarDatosLegacyBypass()` consume este metodo para limpiar la DB en
// cold-boot.
//
// El metodo es idempotente: borrar una cedula inexistente es no-op (no rechaza).
// Esto permite que `limpiarDatosLegacyBypass()` corra multiples veces en el
// mismo arranque sin romper la app.

describe('eliminarPorCedula()', () => {
  it('ejecuta DELETE FROM operarios WHERE numero_cedula = ? con la cedula recibida', async () => {
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
    const db = buildDb({ runAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    await repo.eliminarPorCedula('placeholder');

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, ...params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/DELETE\s+FROM\s+operarios/i);
    expect(sql).toMatch(/WHERE\s+numero_cedula\s*=\s*\?/i);
    expect(params).toEqual(['placeholder']);
  });

  it('resuelve sin lanzar error cuando la cedula no existe en la DB', async () => {
    // expo-sqlite devuelve changes: 0 cuando el WHERE no matchea; el helper
    // expone esto como un await lineal sin error. Esto valida la
    // idempotencia del metodo.
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 0 });
    const db = buildDb({ runAsync });
    const repo = crearOperarioRepositoryExpoSqlite(db);

    await expect(repo.eliminarPorCedula('no-existe')).resolves.toBeUndefined();
    expect(runAsync).toHaveBeenCalledTimes(1);
  });
});

// ── password_hash: persistencia y lectura para login offline (PUNTO A) ──────
//
// TICKET-EPIC-LOGIN-001 — PUNTO A: Login real local contra SQLite.
// El bootstrapCompleto (Fase 5.1) hashea el password del operario con SHA-256
// y se lo pasa a `guardar()`. Para que el Login pueda validar localmente,
// el repo DEBE:
//   - Incluir `password_hash` en el UPSERT (sino el hash se pierde al guardar).
//   - Devolver `password_hash` en `buscarPorCedula`/`listar`/etc. (sino el
//     Login no puede comparar contra el hash guardado).
//
// Sin esto, el Login real contra SQLite es imposible porque el hash nunca
// se persiste ni se lee del row.
//
// TDD Evidence:
//   RED → estos tests fallan antes del commit que agrega `password_hash`
//         al OperarioRow, al SQL_UPSERT y al fromRow().

describe('password_hash (PUNTO A: Login real local)', () => {
  describe('guardar()', () => {
    it('GH1.1 incluye la columna password_hash en el INSERT/UPSERT', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const db = buildDb({ runAsync });
      const repo = crearOperarioRepositoryExpoSqlite(db);

      const borrador = {
        id_prestador: 1,
        numero_cedula: '12345678',
        nombre: 'Ana',
        email: 'ana@test.com',
        password_hash: 'sha256(secret)',
        rol: 'operario' as const,
        estado: 'activo' as const,
      };

      await repo.guardar({
        ...borrador,
        id_operario: 1,
        created_at: '2024-01-15',
      });

      expect(runAsync).toHaveBeenCalledTimes(1);
      const [sql, ...params] = runAsync.mock.calls[0];
      expect(sql).toMatch(/password_hash/i);
      // El hash pasado al repo debe terminar como parametro del SQL
      const paramsStr = JSON.stringify(params);
      expect(paramsStr).toContain('sha256(secret)');
    });

    it('GH1.2 persiste 9 columnas + 9 params (id_operario, id_prestador, numero_cedula, nombre, email, password_hash, rol, estado, dispositivo_id, created_at) → 10 params', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const db = buildDb({ runAsync });
      const repo = crearOperarioRepositoryExpoSqlite(db);

      await repo.guardar({
        id_operario: 7,
        id_prestador: 1,
        numero_cedula: '51800012',
        nombre: 'Ana',
        email: 'ana@test.com',
        password_hash: 'sha256(mi-clave)',
        rol: 'operario',
        estado: 'activo',
        dispositivo_id: undefined,
        created_at: '2024-01-15',
      });

      const [sql, ...params] = runAsync.mock.calls[0];
      // 9 placeholders `?` (id_prestador, numero_cedula, nombre, email,
      // password_hash, rol, estado, dispositivo_id, created_at) — el primer
      // param es id_operario que va en VALUES (...).
      expect(sql).toMatch(/VALUES\s*\(\s*\?,\s*\?,\s*\?,\s*\?,\s*\?,\s*\?,\s*\?,\s*\?,\s*\?,\s*\?\)/i);
      expect(params).toHaveLength(10);
      expect(params).toEqual([
        7,           // id_operario (1er param, antes de VALUES)
        1,           // id_prestador
        '51800012',  // numero_cedula
        'Ana',       // nombre
        'ana@test.com', // email
        'sha256(mi-clave)', // password_hash (NUEVO)
        'operario',  // rol
        'activo',    // estado
        null,        // dispositivo_id
        '2024-01-15', // created_at
      ]);
    });
  });

  describe('fromRow (via buscarPorCedula)', () => {
    it('GH2.1 devuelve el campo password_hash cuando la fila lo trae', async () => {
      const rowConHash = {
        id_operario: 3,
        id_prestador: 1,
        numero_cedula: '51800012',
        nombre: 'Ana',
        email: 'ana@test.com',
        password_hash: 'sha256(mi-clave)', // ← presente en la fila SQL
        rol: 'operario',
        estado: 'activo',
        dispositivo_id: null,
        created_at: '2024-01-15',
      };
      const getFirstAsync = jest.fn().mockResolvedValue(rowConHash);
      const db = buildDb({ getFirstAsync });
      const repo = crearOperarioRepositoryExpoSqlite(db);

      const resultado = await repo.buscarPorCedula('51800012');

      expect(resultado).not.toBeNull();
      expect(resultado!.password_hash).toBe('sha256(mi-clave)');
    });

    it('GH2.2 un Operario devuelto por buscarPorCedula satisface el tipo de dominio (incluye password_hash como string)', async () => {
      const rowConHash = {
        id_operario: 3,
        id_prestador: 1,
        numero_cedula: '51800012',
        nombre: 'Ana',
        email: 'ana@test.com',
        password_hash: 'abc123hash',
        rol: 'operario',
        estado: 'activo',
        dispositivo_id: null,
        created_at: '2024-01-15',
      };
      const db = buildDb({ getFirstAsync: jest.fn().mockResolvedValue(rowConHash) });
      const repo = crearOperarioRepositoryExpoSqlite(db);

      const resultado = await repo.buscarPorCedula('51800012');

      // Type assertion + valor concreto: si fromRow omitiera password_hash,
      // el campo seria undefined y este expect fallaria.
      const operario = resultado as Operario;
      expect(typeof operario.password_hash).toBe('string');
      expect(operario.password_hash).toBe('abc123hash');
    });
  });
});
