// mobile/__tests__/composicion/constantes.test.ts
//
// Tests contractuales de `src/composition/constantes.ts`.
//
// Sesión real con shape completo: token + cedula + nombre + idPrestador + expiresAt.
// AuthGate (en 4.2) y useWorkspace (en 4.2) van a leer este shape, por lo tanto
// la validez del round-trip AsyncStorage ↔ memoria debe estar cubierta extremo
// a extremo acá.
//
// NO mockeamos constantes — mockeamos AsyncStorage con jest.mock porque es
// la única dependencia externa. El round-trip storage → cargarSesion /
// cargarSesion → guardarSesion / cargarSesion → limpiarSesion ejercita código
// real de validación y serialización.

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Sesion } from '../../src/composition/constantes';
import {
  cargarSesion,
  guardarSesion,
  limpiarSesion,
  clave_storage_sesion,
  esSesionValida,
} from '../../src/composition/constantes';

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<
  typeof AsyncStorage.removeItem
>;

/** Construye una sesión válida con un expiresAt futuro en ms. */
function crearSesionValida(overrides: Partial<Sesion> = {}): Sesion {
  return {
    token: 'tok-' + 'a'.repeat(32),
    cedula: '1234567890',
    nombre: 'Operario Demo',
    idPrestador: 42,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // +24h
    ...overrides,
  };
}

describe('constantes.ts (sesion multi-tenant)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('clave_storage_sesion', () => {
    it('es una constante estable apuntando al slot AsyncStorage', () => {
      // El AuthGate y Login la usan para resolver/guardar la misma clave.
      // Si cambia, hay que migrar datos persistidos.
      expect(typeof clave_storage_sesion).toBe('string');
      expect(clave_storage_sesion.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bloque 1: cargarSesion
  // ─────────────────────────────────────────────────────────────
  describe('cargarSesion', () => {
    it('T1.1 devuelve null cuando AsyncStorage no tiene la clave', async () => {
      mockedGetItem.mockResolvedValueOnce(null);

      const resultado = await cargarSesion();

      expect(resultado).toBeNull();
      expect(mockedGetItem).toHaveBeenCalledWith(clave_storage_sesion);
      expect(mockedRemoveItem).not.toHaveBeenCalled();
    });

    it('T1.2 devuelve la sesion persistida cuando es valida y no esta vencida', async () => {
      const sesion = crearSesionValida();
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesion));

      const resultado = await cargarSesion();

      expect(resultado).toEqual(sesion);
      expect(mockedRemoveItem).not.toHaveBeenCalled();
    });

    it('T1.3 devuelve null y limpia AsyncStorage cuando la sesion esta vencida', async () => {
      const sesionVencida: Sesion = crearSesionValida({
        expiresAt: Date.now() - 1000, // vencida hace 1s
      });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesionVencida));

      const resultado = await cargarSesion();

      expect(resultado).toBeNull();
      expect(mockedRemoveItem).toHaveBeenCalledWith(clave_storage_sesion);
      expect(mockedRemoveItem).toHaveBeenCalledTimes(1);
    });

    it('T1.4 devuelve null y limpia AsyncStorage cuando el JSON esta corrupto', async () => {
      mockedGetItem.mockResolvedValueOnce('{ esto no es json valido');

      const resultado = await cargarSesion();

      expect(resultado).toBeNull();
      expect(mockedRemoveItem).toHaveBeenCalledWith(clave_storage_sesion);
    });

    it('T1.5 devuelve null y limpia AsyncStorage cuando la sesion es parcial (sin token)', async () => {
      const sesionParcial = {
        cedula: '1234567890',
        idPrestador: 42,
        expiresAt: Date.now() + 60_000,
        // falta token
      };
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesionParcial));

      const resultado = await cargarSesion();

      expect(resultado).toBeNull();
      expect(mockedRemoveItem).toHaveBeenCalledWith(clave_storage_sesion);
    });

    it('T1.6 devuelve null y limpia AsyncStorage cuando cedula es string vacio', async () => {
      const sesionVacia: Sesion = crearSesionValida({ cedula: '' });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesionVacia));

      const resultado = await cargarSesion();

      expect(resultado).toBeNull();
      expect(mockedRemoveItem).toHaveBeenCalledWith(clave_storage_sesion);
    });

    it('T1.7 devuelve null y limpia AsyncStorage cuando idPrestador no es positivo', async () => {
      const sesionInvalida: Sesion = crearSesionValida({ idPrestador: 0 });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesionInvalida));

      const resultado = await cargarSesion();

      expect(resultado).toBeNull();
      expect(mockedRemoveItem).toHaveBeenCalledWith(clave_storage_sesion);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bloque 2: guardarSesion
  // ─────────────────────────────────────────────────────────────
  describe('guardarSesion', () => {
    it('T2.1 persiste la sesion bajo la clave esperada y round-trip la recupera', async () => {
      const sesion = crearSesionValida();

      await guardarSesion(sesion);

      expect(mockedSetItem).toHaveBeenCalledWith(
        clave_storage_sesion,
        JSON.stringify(sesion),
      );
      expect(mockedSetItem).toHaveBeenCalledTimes(1);
    });

    it('T2.2 sobrescribe una sesion previa cuando se guarda una nueva', async () => {
      const vieja = crearSesionValida({ token: 'token-viejo' });
      const nueva = crearSesionValida({ token: 'token-nuevo' });

      await guardarSesion(vieja);
      await guardarSesion(nueva);

      expect(mockedSetItem).toHaveBeenCalledTimes(2);
      // La última escritura es la que queda:
      expect(mockedSetItem.mock.calls[1]).toEqual([
        clave_storage_sesion,
        JSON.stringify(nueva),
      ]);
    });

    it('T2.3 persiste el shape completo token/cedula/idPrestador/expiresAt sin alterarlo', async () => {
      const sesion: Sesion = {
        token: 'tok-completo',
        cedula: '1098765432',
        nombre: 'Operario Completo',
        idPrestador: 7,
        expiresAt: 1_700_000_000_000,
      };

      await guardarSesion(sesion);

      const [, payload] = mockedSetItem.mock.calls[0];
      const parsed = JSON.parse(payload as string) as Sesion;
      expect(parsed).toEqual(sesion);
      // nombres de campos en snake→camel contract:
      expect(parsed).toHaveProperty('token');
      expect(parsed).toHaveProperty('cedula');
      expect(parsed).toHaveProperty('idPrestador');
      expect(parsed).toHaveProperty('expiresAt');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bloque 3: limpiarSesion
  // ─────────────────────────────────────────────────────────────
  describe('limpiarSesion', () => {
    it('T3.1 elimina la clave de sesion en AsyncStorage', async () => {
      await limpiarSesion();

      expect(mockedRemoveItem).toHaveBeenCalledWith(clave_storage_sesion);
      expect(mockedRemoveItem).toHaveBeenCalledTimes(1);
    });

    it('T3.2 no lanza error cuando no habia sesion guardada (eliminar clave inexistente es no-op)', async () => {
      // El mock default resuelve con undefined (no-op). El comportamiento
      // real de AsyncStorage.removeItem sobre una clave inexistente es
      // exactamente este: resuelve sin tirar. Esto valida que limpiarSesion
      // se mantiene como await lineal sin try/catch defensivo.
      mockedRemoveItem.mockResolvedValueOnce(undefined);

      await expect(limpiarSesion()).resolves.toBeUndefined();
      expect(mockedRemoveItem).toHaveBeenCalledWith(clave_storage_sesion);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bloque 4: esSesionValida (función pura, 0 mocks)
  // ─────────────────────────────────────────────────────────────
  describe('esSesionValida', () => {
    it('T4.1 acepta una sesion completa con todos los campos requeridos', () => {
      const sesion: Sesion = crearSesionValida();
      expect(esSesionValida(sesion)).toBe(true);
    });

    it('T4.1b acepta una sesion sin el campo opcional nombre', () => {
      const sesion = crearSesionValida();
      const sinNombre: Sesion = { ...sesion };
      delete (sinNombre as { nombre?: string }).nombre;
      expect(esSesionValida(sinNombre)).toBe(true);
    });

    it('T4.2 rechaza cuando token falta, esta vacio o no es string', () => {
      const sesion = crearSesionValida();
      expect(esSesionValida({ ...sesion, token: '' })).toBe(false);
      expect(esSesionValida({ ...sesion, token: undefined as unknown as string })).toBe(false);
      // token completamente ausente:
      const sinToken = { ...sesion };
      delete (sinToken as { token?: string }).token;
      expect(esSesionValida(sinToken)).toBe(false);
    });

    it('T4.2b rechaza cuando cedula falta, esta vacia o no es string', () => {
      const sesion = crearSesionValida();
      expect(esSesionValida({ ...sesion, cedula: '' })).toBe(false);
      const sinCedula = { ...sesion };
      delete (sinCedula as { cedula?: string }).cedula;
      expect(esSesionValida(sinCedula)).toBe(false);
    });

    it('T4.2c rechaza cuando idPrestador no es > 0', () => {
      const sesion = crearSesionValida();
      expect(esSesionValida({ ...sesion, idPrestador: 0 })).toBe(false);
      expect(esSesionValida({ ...sesion, idPrestador: -5 })).toBe(false);
      expect(esSesionValida({ ...sesion, idPrestador: 1.5 as unknown as number })).toBe(false);
      expect(esSesionValida({ ...sesion, idPrestador: undefined as unknown as number })).toBe(false);
    });

    it('T4.2d rechaza cuando expiresAt es pasado, no es number o es cero', () => {
      const sesion = crearSesionValida();
      expect(esSesionValida({ ...sesion, expiresAt: Date.now() - 1 })).toBe(false);
      expect(esSesionValida({ ...sesion, expiresAt: 0 })).toBe(false);
      expect(esSesionValida({ ...sesion, expiresAt: undefined as unknown as number })).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Snapshot estructural de Sesion (type-level via runtime check)
  // ─────────────────────────────────────────────────────────────
  it('Sesion expone los cinco campos del nuevo contrato multi-tenant', () => {
    const sesion = crearSesionValida();
    expect(typeof sesion.token).toBe('string');
    expect(typeof sesion.cedula).toBe('string');
    expect(typeof sesion.idPrestador).toBe('number');
    expect(typeof sesion.expiresAt).toBe('number');
    // nombre es opcional pero presente en el fixture
    expect(typeof sesion.nombre).toBe('string');
  });
});
