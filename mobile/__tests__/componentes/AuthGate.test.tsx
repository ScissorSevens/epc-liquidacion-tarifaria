// mobile/__tests__/componentes/AuthGate.test.tsx
//
// Tests contractuales del AuthGate (Fase 4 Tarea 4.2.2).
//
// AuthGate detecta 4 estados en cold-boot:
//   1. sin_setup: prestadorRepo.listar() devuelve [] -> placeholder de SetupInicial
//   2. sin_sesion: hay prestadores pero no hay sesion -> Login
//   3. con_sesion: hay prestadores y sesion valida -> RootNavigator (sincroniza useWorkspace)
//   4. loading: mientras decide -> SplashAnimado
//
// Orden de deteccion:
//   prestadores.length === 0  -> sin_setup (tiene prioridad sobre sesion)
//   cargarSesion() === null    -> sin_sesion
//   cargarSesion() valida      -> con_sesion (sync workspace + RootNavigator)
//
// Mantiene el dual-flag anti-flicker: hideAsync se llama solo cuando splash
// esta completo Y decision !== 'loading'.
//
// Mocks:
//   - expo-splash-screen: hideAsync espia para verificar anti-flicker
//   - AsyncStorage: getItem/setItem/removeItem (cargarSesion/guardarSesion)
//   - SplashAnimado: useEffect dispara onAnimationEnd salvo que el test lo deshabilite
//   - Login: stub con onPress=onLoginSuccess
//   - RootNavigator: stub con onPress=onLogoutRequested
//   - NavigationContainer: pasa-through
//   - getBootstrap: controla prestadorRepo.listar() para forzar sin_setup vs sin_sesion
//   - useWorkspace: spy para verificar que setSesionCompleta se llama en con_sesion

import { render, waitFor, act } from '@testing-library/react-native';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

let mockSplashAnimadoDebeLlamarOnAnimationEnd = true;
let mockSplashAnimadoCallback: (() => void) | null = null;

jest.mock('../../src/componentes/SplashAnimado', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    SplashAnimado: ({ onAnimationEnd }: { onAnimationEnd: () => void }) => {
      React.useEffect(() => {
        mockSplashAnimadoCallback = onAnimationEnd;
        if (mockSplashAnimadoDebeLlamarOnAnimationEnd) {
          onAnimationEnd();
        }
      }, [onAnimationEnd]);
      return React.createElement(Text, null, 'splash-animado-mock');
    },
  };
});

jest.mock('../../src/pantallas/Login', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onLoginSuccess }: { onLoginSuccess: () => void }) =>
      React.createElement(Text, { onPress: onLoginSuccess }, 'login-mock'),
  };
});

jest.mock('../../src/navegacion/RootNavigator', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onLogoutRequested }: { onLogoutRequested: () => void }) =>
      React.createElement(
        Text,
        { onPress: onLogoutRequested },
        'root-navigator-mock',
      ),
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

import { AuthGate } from '../../src/componentes/AuthGate';
import { getBootstrap } from '../../src/composition/get-bootstrap';
import { useWorkspace } from '../../src/composicion/useWorkspace';
import type { Sesion } from '../../src/composition/constantes';

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockedHideAsync = SplashScreen.hideAsync as jest.MockedFunction<
  typeof SplashScreen.hideAsync
>;
const mockedGetBootstrap = getBootstrap as jest.MockedFunction<
  typeof getBootstrap
>;

/** Construye una sesion valida con expiresAt futuro. */
function crearSesionValida(overrides: Partial<Sesion> = {}): Sesion {
  return {
    token: 'tok-' + 'a'.repeat(32),
    cedula: '1234567890',
    nombre: 'Operario Demo',
    idPrestador: 42,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

/** Stub del bootstrap con `prestadorRepo.listar()` configurable. */
function mockBootstrapConPrestadores(prestadores: unknown[]): void {
  mockedGetBootstrap.mockResolvedValue({
    prestadorRepo: { listar: jest.fn().mockResolvedValue(prestadores) },
  } as never);
}

describe('AuthGate (Fase 4.2 — 4 estados)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSplashAnimadoDebeLlamarOnAnimationEnd = true;
    mockSplashAnimadoCallback = null;
    // Reset del store por si tests anteriores lo dejaron modificado.
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
  // Estado sin_setup
  // ─────────────────────────────────────────────────────────────
  describe('estado sin_setup', () => {
    it('A1.1 muestra placeholder de SetupInicial cuando no hay prestadores en DB', async () => {
      mockBootstrapConPrestadores([]);
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText(/Setup inicial pendiente/i);
      expect(queryByText('login-mock')).toBeNull();
      expect(queryByText('root-navigator-mock')).toBeNull();
    });

    it('A1.2 muestra sin_setup incluso si AsyncStorage tiene una sesion persistida', async () => {
      // La deteccion de setup es PRIORITARIA — el operario debe pasar
      // por el wizard de setup inicial antes de poder loguearse, aun
      // si quedo una sesion residual en storage.
      mockBootstrapConPrestadores([]);
      const sesion = crearSesionValida();
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesion));

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText(/Setup inicial pendiente/i);
      expect(queryByText('root-navigator-mock')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Estado sin_sesion
  // ─────────────────────────────────────────────────────────────
  describe('estado sin_sesion', () => {
    it('A2.1 muestra Login cuando hay prestadores pero no hay sesion persistida', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('login-mock');
      expect(queryByText(/Setup inicial pendiente/i)).toBeNull();
      expect(queryByText('root-navigator-mock')).toBeNull();
    });

    it('A2.2 muestra Login cuando hay prestadores pero la sesion esta vencida', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      const sesionVencida = crearSesionValida({ expiresAt: Date.now() - 1000 });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesionVencida));

      const { findByText } = render(<AuthGate />);

      await findByText('login-mock');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Estado con_sesion
  // ─────────────────────────────────────────────────────────────
  describe('estado con_sesion', () => {
    it('A3.1 muestra RootNavigator cuando hay prestadores y sesion valida', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 42 }]);
      const sesion = crearSesionValida({ idPrestador: 42 });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesion));

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('root-navigator-mock');
      expect(queryByText('login-mock')).toBeNull();
    });

    it('A3.2 sincroniza useWorkspace.id_prestador_activo con sesion.idPrestador', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 7 }]);
      const sesion = crearSesionValida({ idPrestador: 7 });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesion));

      render(<AuthGate />);

      await waitFor(() => {
        expect(useWorkspace.getState().id_prestador_activo).toBe(7);
      });
    });

    it('A3.3 invoca setSesionCompleta del workspace con la sesion resuelta', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 9 }]);
      const sesion = crearSesionValida({ idPrestador: 9 });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesion));

      const spySetSesion = jest.spyOn(useWorkspace.getState(), 'setSesionCompleta');

      render(<AuthGate />);

      await waitFor(() => {
        expect(useWorkspace.getState().id_prestador_activo).toBe(9);
      });
      expect(spySetSesion).toHaveBeenCalledWith(sesion);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Estado loading
  // ─────────────────────────────────────────────────────────────
  describe('estado loading', () => {
    it('A4.1 muestra SplashAnimado mientras bootstrap resuelve prestadores', async () => {
      // Bootstrap que TARDAR en resolver: el splash debe verse primero.
      let resolverBootstrap: (v: unknown) => void = () => {};
      mockedGetBootstrap.mockImplementation(
        () => new Promise((resolve) => { resolverBootstrap = resolve; }) as never,
      );
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      // Antes de resolver el bootstrap, AuthGate esta en 'loading'
      expect(mockSplashAnimadoCallback).not.toBeNull();
      await findByText('splash-animado-mock');
      expect(queryByText('login-mock')).toBeNull();

      // Ahora resolvemos el bootstrap -> deberia ir a sin_sesion
      resolverBootstrap({ prestadorRepo: { listar: jest.fn().mockResolvedValue([{ id_prestador: 1 }]) } });
      await findByText('login-mock');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Dual-flag anti-flicker: hideAsync gating
  // ─────────────────────────────────────────────────────────────
  describe('SplashScreen.hideAsync (dual-flag anti-flicker)', () => {
    it('A5.1 invoca hideAsync cuando splash + decision resuelta', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      mockedGetItem.mockResolvedValueOnce(null);

      render(<AuthGate />);

      await waitFor(() => {
        expect(mockedHideAsync).toHaveBeenCalledTimes(1);
      });
    });

    it('A5.2 NO invoca hideAsync hasta que splash termina aunque sesion este resuelta', async () => {
      mockSplashAnimadoDebeLlamarOnAnimationEnd = false;
      mockBootstrapConPrestadores([{ id_prestador: 42 }]);
      const sesion = crearSesionValida({ idPrestador: 42 });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesion));

      const { findByText } = render(<AuthGate />);

      await findByText('root-navigator-mock');
      expect(mockedHideAsync).not.toHaveBeenCalled();

      await act(async () => {
        mockSplashAnimadoCallback?.();
      });

      await waitFor(() => {
        expect(mockedHideAsync).toHaveBeenCalledTimes(1);
      });
    });
  });
});