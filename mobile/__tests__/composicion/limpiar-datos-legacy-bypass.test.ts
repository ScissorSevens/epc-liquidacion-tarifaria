// mobile/__tests__/composicion/limpiar-datos-legacy-bypass.test.ts
//
// Tests contractuales de `limpiarDatosLegacyBypass()` — helper de cold-boot
// introducido en la Fase 4 Tarea 4.3.2 del TICKET-EPIC-LOGIN-001.
//
// QUE HACE:
//   - Detecta operarios con `id_operario = 0` o `numero_cedula = 'placeholder'`
//     (datos basura dejados por el bypass viejo de Configuracion.tsx,
//     eliminado en 4.3.1).
//   - Borra esos operarios de la tabla `operarios` (via repo.eliminarPorCedula).
//   - Borra la clave `cedula_operario` de AsyncStorage defensivamente.
//   - Es IDEMPOTENTE: correrla varias veces en el mismo arranque no rompe nada.
//
// POR QUE ES NECESARIO:
//   Sin este helper, cualquier dispositivo que se actualizo con una version
//   de la app que tenia el bypass quedaria con un operario fantasma
//   (id=0, cedula='placeholder') en su DB. El flujo de carga podria
//   considerarlo como "ya logueado" con datos basura. Este helper limpia
//   esa condicion al arrancar.
//
// API:
//   await limpiarDatosLegacyBypass(db)
//     `db` es la conexion SQLite del bootstrap (expo-sqlite). El helper
//     construye el repo internamente — el caller (AuthGate) no necesita
//     conocer el detalle.
//
// MOCKS:
//   - db mockeada a nivel expo-sqlite (buildDb del patron operario-repo test).
//   - AsyncStorage (removeItem espia para verificar limpieza).
//   - getBootstrap no se usa — el helper recibe db por parametro (DI).
//
// TDD Evidence:
//   RED  → tests escritos antes de la implementacion. 6 tests fallan porque
//          la funcion no existe (TypeError) o no borra lo esperado.
//   GREEN → implementacion pasa 6/6.

import {
  crearOperarioRepositoryExpoSqlite,
  type OperarioRepositoryExpoSqlite,
} from '../../src/persistencia/expo-sqlite/operario-repository-expo-sqlite';
import { limpiarDatosLegacyBypass } from '../../src/composition/migracion-datos-legacy';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<
  typeof AsyncStorage.removeItem
>;

// ── helpers ────────────────────────────────────────────────────────────────

function buildRow(overrides: Partial<{
  id_operario: number;
  id_prestador: number;
  numero_cedula: string;
  nombre: string;
  email: string;
  rol: string;
  estado: string;
}> = {}) {
  return {
    id_operario: 1,
    id_prestador: 1,
    numero_cedula: '123',
    nombre: 'Ana',
    email: 'ana@test.com',
    rol: 'operario',
    estado: 'activo',
    dispositivo_id: null,
    created_at: null,
    ...overrides,
  };
}

/**
 * Construye una DB mock + repo expo-sqlite apuntando a filas dadas.
 * El repo es REAL (no mockeado): el helper ejecuta `listar()` y
 * `eliminarPorCedula()` contra los mocks de expo-sqlite, que es lo
 * que queremos verificar end-to-end.
 */
function buildRepoConOperarios(
  filasIniciales: ReturnType<typeof buildRow>[],
): { repo: OperarioRepositoryExpoSqlite; runAsync: jest.Mock; getAllAsync: jest.Mock } {
  const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
  const getAllAsync = jest.fn().mockResolvedValue(filasIniciales);
  const db = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync,
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync,
  } as never;
  const repo = crearOperarioRepositoryExpoSqlite(db);
  return { repo, runAsync, getAllAsync };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('limpiarDatosLegacyBypass()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('B1.1 borra operarios con id_operario = 0 (datos legacy del bypass viejo)', async () => {
    const { repo, runAsync } = buildRepoConOperarios([
      buildRow({ id_operario: 0, numero_cedula: 'placeholder', nombre: 'Dummy A' }),
      buildRow({ id_operario: 0, numero_cedula: 'otro', nombre: 'Dummy B' }),
    ]);

    await limpiarDatosLegacyBypass(repo);

    // runAsync llamado 2 veces con DELETE para cada cedula legacy.
    const deleteCalls = runAsync.mock.calls.filter(
      ([sql]: [string]) => /DELETE\s+FROM\s+operarios/i.test(sql),
    );
    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls.map(([, cedula]) => cedula)).toEqual(['placeholder', 'otro']);
  });

  it('B1.2 borra operarios con numero_cedula = "placeholder"', async () => {
    const { repo, runAsync } = buildRepoConOperarios([
      buildRow({ id_operario: 5, numero_cedula: 'placeholder', nombre: 'Otro Dummy' }),
    ]);

    await limpiarDatosLegacyBypass(repo);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE\s+FROM\s+operarios/i),
      'placeholder',
    );
  });

  it('B1.3 NO borra operarios validos (id_operario > 0 y cedula != placeholder)', async () => {
    const { repo, runAsync } = buildRepoConOperarios([
      buildRow({ id_operario: 42, numero_cedula: '51800012', nombre: 'Real' }),
      buildRow({ id_operario: 7, numero_cedula: '999', nombre: 'Otro Real' }),
    ]);

    await limpiarDatosLegacyBypass(repo);

    const deleteCalls = runAsync.mock.calls.filter(
      ([sql]: [string]) => /DELETE/i.test(sql),
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it('B1.4 limpia la clave "cedula_operario" de AsyncStorage al finalizar', async () => {
    const { repo } = buildRepoConOperarios([]);

    await limpiarDatosLegacyBypass(repo);

    expect(mockedRemoveItem).toHaveBeenCalledWith('cedula_operario');
  });

  it('B1.5 es idempotente: correrla dos veces seguidas no rompe nada', async () => {
    const { repo } = buildRepoConOperarios([]);

    await expect(limpiarDatosLegacyBypass(repo)).resolves.toBeUndefined();
    await expect(limpiarDatosLegacyBypass(repo)).resolves.toBeUndefined();

    // removeItem llamado 2 veces (una por corrida) sin error.
    expect(mockedRemoveItem).toHaveBeenCalledTimes(2);
  });

  it('B1.6 borra operario legacy Y limpia AsyncStorage en una sola corrida', async () => {
    const { repo, runAsync } = buildRepoConOperarios([
      buildRow({ id_operario: 0, numero_cedula: 'placeholder', nombre: 'Dummy' }),
    ]);

    await limpiarDatosLegacyBypass(repo);

    // DELETE disparado
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE/i),
      'placeholder',
    );
    // Y ademas AsyncStorage limpio
    expect(mockedRemoveItem).toHaveBeenCalledWith('cedula_operario');
  });
});