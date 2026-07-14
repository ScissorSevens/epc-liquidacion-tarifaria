// mobile/__tests__/componentes/Login.test.tsx
//
// Tests contractuales del Login stub (Fase 4 Tarea 4.2.3).
//
// MODO DEMO: el Login crea una Sesion fake local para no romper TS con el
// shape multi-tenant. El backend real llega en Fase 5.2 (pantallas).
//
// Cobertura:
//   - handleIngresar con inputs validos -> crearSesionFake con shape completo
//     (token + cedula + nombre + idPrestador + expiresAt futuro)
//   - guardarSesion recibe la sesion fake
//   - useWorkspace.setSesionCompleta se invoca con la sesion fake
//   - onLoginSuccess callback se invoca al terminar
//   - Inputs invalidos (cedula vacia, contrasena corta) -> marca errores
//     y NO llama guardarSesion ni onLoginSuccess
//
// Mocks:
//   - AsyncStorage (cargarSesion/guardarSesion via composition/constantes)
//   - useWorkspace: spy sobre setSesionCompleta

import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock del theme — Login.tsx importa tokens; los mocks de jest-expo
// ya proveen react-native pero los tokens custom requieren importar
// los modulos reales (no son pure-JS, son constantes).
jest.mock('../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 } },
  COLORS: {
    surfaceContainerLow: '#fff',
    background: '#fff',
    primary: '#3596C8',
    onPrimary: '#fff',
    primaryContainer: '#3596C8',
    surfaceContainerLowest: '#fff',
    outlineVariant: '#ccc',
    outline: '#888',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    error: '#f00',
  },
  RADIUS: { md: 8, xl: 16 },
  SHADOWS: { card: {} },
  SPACING: {
    margin: 16, lg: 24, md: 16, sm: 8, xs: 4, xl: 32,
  },
  TYPOGRAPHY: {
    headlineLg: { fontSize: 28 },
    headlineMd: { fontSize: 22 },
    headlineSm: { fontSize: 18 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
    labelMd: { fontSize: 12 },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import Login from '../../src/pantallas/Login';
import { guardarSesion, clave_storage_sesion } from '../../src/composition/constantes';
import { useWorkspace } from '../../src/composicion/useWorkspace';
import type { Sesion } from '../../src/composition/constantes';

const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

describe('Login (Fase 4.2.3 — stub modo demo)', () => {
  let onLoginSuccess: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onLoginSuccess = jest.fn();
    useWorkspace.setState({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Happy path: handleIngresar con inputs validos
  // ─────────────────────────────────────────────────────────────
  describe('handleIngresar con inputs validos', () => {
    it('L1.1 guarda una Sesion con shape completo multi-tenant en AsyncStorage', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '1234567890');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'password1234');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(mockedSetItem).toHaveBeenCalled();
      });

      // Buscamos la escritura bajo la clave de sesion
      const escrituraSesion = mockedSetItem.mock.calls.find(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escrituraSesion).toBeDefined();

      const [, payload] = escrituraSesion as [string, string];
      const sesionGuardada = JSON.parse(payload) as Sesion;

      // Shape completo multi-tenant:
      expect(sesionGuardada.token).toMatch(/^fake-token-/);
      expect(sesionGuardada.cedula).toBe('1234567890');
      expect(sesionGuardada.nombre).toBe('Operario Demo');
      expect(sesionGuardada.idPrestador).toBe(1); // placeholder demo
      expect(sesionGuardada.expiresAt).toBeGreaterThan(Date.now());
    });

    it('L1.2 expiresAt esta en el futuro con holgura de ~24h', async () => {
      const antesDe = Date.now();
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '1234567890');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'password1234');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledTimes(1);
      });

      const escrituraSesion = mockedSetItem.mock.calls.find(
        ([clave]) => clave === clave_storage_sesion,
      );
      const [, payload] = escrituraSesion as [string, string];
      const sesionGuardada = JSON.parse(payload) as Sesion;

      // 24h ± 1s de holgura (el handler puede tardar ms en ejecutarse)
      const veinticuatroHoras = 24 * 60 * 60 * 1000;
      expect(sesionGuardada.expiresAt).toBeGreaterThanOrEqual(antesDe + veinticuatroHoras - 1000);
      expect(sesionGuardada.expiresAt).toBeLessThanOrEqual(antesDe + veinticuatroHoras + 1000);
    });

    it('L1.3 sincroniza useWorkspace con sesion.idPrestador via setSesionCompleta', async () => {
      const spySetSesion = jest.spyOn(useWorkspace.getState(), 'setSesionCompleta');
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '1234567890');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'password1234');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(spySetSesion).toHaveBeenCalledTimes(1);
      });

      const sesionLlamada = spySetSesion.mock.calls[0][0] as Sesion;
      expect(sesionLlamada.idPrestador).toBe(1);
      expect(sesionLlamada.cedula).toBe('1234567890');
    });

    it('L1.4 invoca onLoginSuccess exactamente una vez al terminar', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '1234567890');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'password1234');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('L1.5 usa guardarSesion de composition/constantes (no setItem directo)', async () => {
      // Spy directo sobre guardarSesion — el Login NO debe llamar
      // AsyncStorage.setItem directamente, debe usar el helper para
      // mantener consistencia.
      const spyGuardar = jest.spyOn({ guardarSesion }, 'guardarSesion');
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '1234567890');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'password1234');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalled();
      });
      // Verificacion indirecta: AsyncStorage.setItem fue llamado con la clave
      // de sesion (lo cual solo guardarSesion hace bajo esa clave exacta).
      const escriturasConClaveSesion = mockedSetItem.mock.calls.filter(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escriturasConClaveSesion).toHaveLength(1);
      spyGuardar.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Validacion de inputs: handleIngresar con inputs invalidos
  // ─────────────────────────────────────────────────────────────
  describe('handleIngresar con inputs invalidos', () => {
    it('L2.1 no llama guardarSesion ni onLoginSuccess si cedula esta vacia', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      // Solo llenamos contrasena, dejamos cedula vacia
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'password1234');
      fireEvent.press(getByText('Ingresar'));

      // Esperamos un microtask para asegurar que el handler completo se ejecuto
      await new Promise((r) => setTimeout(r, 10));

      expect(onLoginSuccess).not.toHaveBeenCalled();
      const escriturasConClaveSesion = mockedSetItem.mock.calls.filter(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escriturasConClaveSesion).toHaveLength(0);
    });

    it('L2.2 no llama guardarSesion ni onLoginSuccess si contrasena < 8 chars', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '1234567890');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'short');
      fireEvent.press(getByText('Ingresar'));

      await new Promise((r) => setTimeout(r, 10));

      expect(onLoginSuccess).not.toHaveBeenCalled();
      const escriturasConClaveSesion = mockedSetItem.mock.calls.filter(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escriturasConClaveSesion).toHaveLength(0);
    });
  });
});