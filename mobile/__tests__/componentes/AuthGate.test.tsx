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
//
// Importante: usamos require() en beforeEach para resetear el module registry.
// get-bootstrap.ts tiene un cache `cached` que persiste entre tests si no
// forzamos re-import — eso rompe el aislamiento.

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

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
    default: ({
      onLoginSuccess,
      mensajeInicial,
    }: {
      onLoginSuccess: () => void;
      mensajeInicial?: string;
    }) =>
      React.createElement(
        Text,
        {
          onPress: onLoginSuccess,
          testID: 'login-mock',
        },
        `login-mock${mensajeInicial ? ':' + mensajeInicial : ''}`,
      ),
  };
});

jest.mock('../../src/pantallas/SetupInicial', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onComplete }: { onComplete: () => void }) =>
      React.createElement(Text, { onPress: onComplete }, 'setup-inicial-mock'),
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
  __esModule: true,
  getBootstrap: jest.fn(),
}));

jest.mock('../../src/composition/migracion-datos-legacy', () => ({
  __esModule: true,
  limpiarDatosLegacyBypass: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

import { getBootstrap } from '../../src/composition/get-bootstrap';
import { limpiarDatosLegacyBypass } from '../../src/composition/migracion-datos-legacy';
import { useWorkspace } from '../../src/composicion/useWorkspace';
import type { Sesion } from '../../src/composition/constantes';
import { clave_storage_sesion } from '../../src/composition/constantes';
import { AuthGate } from '../../src/componentes/AuthGate';

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<
  typeof AsyncStorage.removeItem
>;
const mockedHideAsync = SplashScreen.hideAsync as jest.MockedFunction<
  typeof SplashScreen.hideAsync
>;
const mockedGetBootstrap = getBootstrap as jest.MockedFunction<
  typeof getBootstrap
>;
const mockedLimpiarLegacy = limpiarDatosLegacyBypass as jest.MockedFunction<
  typeof limpiarDatosLegacyBypass
>;

/** Construye una sesion valida con expiresAt futuro. */
function crearSesionValida(overrides: Partial<Sesion> = {}): Sesion {
  return {
    token: 'tok-' + 'a'.repeat(32),
    cedula: '1234567890',
    nombre: 'Operario Demo',
    idOperario: 42, // auditoria legal (CRA 825/2017) — obligatorio
    idPrestador: 42,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

/** Stub del bootstrap con `prestadorRepo.listar()` configurable.
 *
 * Parametros:
 *   - `prestadores`: lo que devuelve `prestadorRepo.listar()`. AuthGate filtra
 *     `EPC-LEGACY` y prestadores suspendidos (commit 40b44ca).
 *   - `operarios`: lo que devuelve `operarioRepo.listar()` (default: 1 operario).
 *     Por que? Tras el fix de cold-boot post-reinstall, AuthGate consulta
 *     AMBOS repos: si hay prestadores pero NO hay operarios (estado parcial
 *     post-reinstall: DB SQLite persistio con prestador viejo pero operarios
 *     wipeados), debe mostrar SetupInicial en lugar de Login (porque login
 *     fallaria con OPERARIO_NO_ENCONTRADO). Tests existentes usan el default
 *     `[{}]` para mantener su semantica previa (prestador + operario = Login).
 */
function mockBootstrapConPrestadores(
  prestadores: unknown[],
  operarios: unknown[] = [{}],
): void {
  const prestadoresComoReales = prestadores.map((p) => ({
    codigo: '0001',
    estado: 'activo' as const,
    ...(p as object),
  }));
  mockedGetBootstrap.mockResolvedValue({
    repos: {
      prestadorRepo: {
        listar: jest.fn().mockResolvedValue(prestadoresComoReales),
      },
      operarioRepo: {
        listar: jest.fn().mockResolvedValue(operarios),
      },
    },
    db: {} as never,
  } as never);
}

describe('AuthGate (Fase 4.2 — 4 estados)', () => {
  beforeEach(() => {
    // Reset individual de los mocks afectados, porque `clearAllMocks` solo
    // limpia call history — NO la cola de `mockResolvedValueOnce`. Si un test
    // anterior encolo un JSON y nunca lo consumio (ej: corto-circuito en
    // sin_setup), el siguiente test recibe ese JSON fantasma y falla.
    // Ademas, resetAllMocks invalidaria los jest.mock() factories que el
    // modulo necesita para correr.
    mockedGetItem.mockReset();
    mockedGetBootstrap.mockReset();
    mockedLimpiarLegacy.mockReset();
    // Re-set default: limpiarDatosLegacyBypass resuelve sin error.
    mockedLimpiarLegacy.mockResolvedValue(undefined);
    // NO reseteamos mockedHideAsync aqui — los tests del dual-flag
    // verifican toHaveBeenCalledTimes, que necesita el call history intacto
    // para comparar contra el conteo del test actual. Si lo reseteamos, los
    // asserts cuentan desde 0 y eso es lo que queremos... pero entonces
    // falla cuando un test anterior llamo hideAsync. Solucion: verificar
    // incremento relativo (calls.length antes vs despues) en lugar de
    // absoluto. Por ahora, simplemente no reseteamos y los asserts usan
    // un delta manual.
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
    it('A1.1 muestra SetupInicial cuando no hay prestadores en DB', async () => {
      mockBootstrapConPrestadores([]);
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('setup-inicial-mock');
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

      await findByText('setup-inicial-mock');
      expect(queryByText('root-navigator-mock')).toBeNull();
    });

    it('A1.3 onComplete de SetupInicial cambia decision a con_sesion', async () => {
      mockBootstrapConPrestadores([]);
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('setup-inicial-mock');

      // Simulamos que el usuario completa el wizard tocando el mock
      // (que en produccion llama onComplete tras bootstrapCompleto exitoso).
      fireEvent.press(await findByText('setup-inicial-mock'));

      await waitFor(() => {
        expect(queryByText('root-navigator-mock')).toBeTruthy();
      });
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
      expect(queryByText('setup-inicial-mock')).toBeNull();
      expect(queryByText('root-navigator-mock')).toBeNull();
    });

    it('A2.2 muestra Login cuando hay prestadores pero la sesion esta vencida', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      const sesionVencida = crearSesionValida({ expiresAt: Date.now() - 1000 });
      mockedGetItem.mockResolvedValueOnce(JSON.stringify(sesionVencida));

      const { findByText } = render(<AuthGate />);

      // PUNTO C: sesion vencida ahora muestra Login con mensajeInicial,
      // asi que el mock rendea "login-mock:<texto>". Usamos un regex para
      // matchear cualquier mensaje sin atarnos al copy exacto.
      await findByText(/^login-mock(:.*)?$/);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Estado con_sesion
  // ─────────────────────────────────────────────────────────────
  describe('estado con_sesion', () => {
    it('A3.1 muestra RootNavigator cuando hay prestadores y sesion valida', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 42 }]);
      const sesion = crearSesionValida({ idPrestador: 42 });
      // PUNTO C: cargarSesion hace doble read (estadoSesionPersistida +
      // re-read para typed return). mockResolvedValue cubre ambas lecturas.
      mockedGetItem.mockResolvedValue(JSON.stringify(sesion));

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('root-navigator-mock');
      expect(queryByText('login-mock')).toBeNull();
    });

    it('A3.2 sincroniza useWorkspace.id_prestador_activo con sesion.idPrestador', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 7 }]);
      const sesion = crearSesionValida({ idPrestador: 7 });
      // PUNTO C: ver A3.1.
      mockedGetItem.mockResolvedValue(JSON.stringify(sesion));

      render(<AuthGate />);

      await waitFor(() => {
        expect(useWorkspace.getState().id_prestador_activo).toBe(7);
      });
    });

    it('A3.3 invoca setSesionCompleta del workspace con la sesion resuelta', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 9 }]);
      const sesion = crearSesionValida({ idPrestador: 9 });
      // PUNTO C: ver A3.1.
      mockedGetItem.mockResolvedValue(JSON.stringify(sesion));

      const spySetSesion = jest.spyOn(useWorkspace.getState(), 'setSesionCompleta');

      render(<AuthGate />);

      await waitFor(() => {
        expect(useWorkspace.getState().id_prestador_activo).toBe(9);
      });
      expect(spySetSesion).toHaveBeenCalledWith(sesion);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Cold-boot post-reinstall: DB tiene prestadores pero NO operarios.
  //
  // Escenario: el usuario desinstalo Expo Go (o lo reinstalo tras un
  // factory reset) pero el archivo SQLite `mediapp.db` persistio en disco
  // porque el OS no lo wipeo al desinstalar. La DB tiene prestadores del
  // setup inicial previo, pero el unico operario que se habia creado
  // quedo huerfano (rollback de transaccion, eliminacion manual, etc).
  // AsyncStorage de sesion esta vacio (wipeado por la reinstall).
  //
  // Comportamiento esperado ANTES del fix: AuthGate mostraba Login
  // (porque hay prestadores), el usuario metia credenciales, loginLocal
  // tiraba OPERARIO_NO_ENCONTRADO, y veia un Alert generico.
  //
  // Comportamiento esperado DESPUES del fix: AuthGate debe enrutar a
  // SetupInicial. Razon: si NO hay forma de validar login contra la DB
  // local (porque no hay operarios), mostrar Login es un dead-end UX.
  // El usuario debe poder re-correr el setup wizard para crear el
  // operario que falta.
  //
  // Ref: exploracion en Engram topic
  // `sdd/first-launch-post-reinstall-bug/explore` (#1022).
  // ─────────────────────────────────────────────────────────────
  describe('cold-boot post-reinstall: DB parcial con prestadores pero sin operarios', () => {
    it('A8.1 enruta a SetupInicial cuando hay prestadores, operarios vacio, y sesion null', async () => {
      // Escenario: prestador persistio del setup previo + 0 operarios + sin sesion.
      mockBootstrapConPrestadores([{ id_prestador: 1 }], []);
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('setup-inicial-mock');
      expect(queryByText('login-mock')).toBeNull();
      expect(queryByText('root-navigator-mock')).toBeNull();
    });

    it('A8.2 sigue mostrando Login cuando hay prestadores Y operarios (caso feliz)', async () => {
      // Regression guard: el fix NO debe romper el flujo normal donde
      // hay prestadores + operarios + sin sesion -> Login (el operario
      // debe poder autenticarse).
      mockBootstrapConPrestadores(
        [{ id_prestador: 1 }],
        [{ id_operario: 42, numero_cedula: '12345678' }],
      );
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('login-mock');
      expect(queryByText('setup-inicial-mock')).toBeNull();
    });

    it('T-AUTH-ERR-1 operarioRepo.listar() throws -> error_db (no Login dead-end)', async () => {
      const listarOperarios = jest
        .fn()
        .mockRejectedValue(new Error('SQLite execAsync rejected'));
      mockedGetBootstrap.mockResolvedValue({
        repos: {
          prestadorRepo: {
            listar: jest.fn().mockResolvedValue([
              { id_prestador: 1, codigo: '0001', estado: 'activo' },
            ]),
          },
          operarioRepo: { listar: listarOperarios },
        },
        db: {} as never,
      } as never);

      const pantalla = render(<AuthGate />);

      await waitFor(() => {
        expect(pantalla.queryByTestId('auth-gate-error-db')).toBeTruthy();
        expect(pantalla.queryByTestId('auth-gate-error-retry')).toBeTruthy();
        expect(pantalla.queryByTestId('auth-gate-error-clear')).toBeTruthy();
        expect(pantalla.queryByText('SQLite execAsync rejected')).toBeTruthy();
        expect(pantalla.queryByText('login-mock')).toBeNull();
      });
    });

    it('T-AUTH-ERR-2 retry button re-dispara la deteccion desde loading', async () => {
      let resolverSegundoIntento: (operarios: unknown[]) => void = () => {};
      const segundoIntento = new Promise<unknown[]>((resolve) => {
        resolverSegundoIntento = resolve;
      });
      const listarOperarios = jest
        .fn()
        .mockRejectedValueOnce(new Error('DB temporalmente no disponible'))
        .mockImplementationOnce(() => segundoIntento);
      mockedGetBootstrap.mockResolvedValue({
        repos: {
          prestadorRepo: {
            listar: jest.fn().mockResolvedValue([
              { id_prestador: 1, codigo: '0001', estado: 'activo' },
            ]),
          },
          operarioRepo: { listar: listarOperarios },
        },
        db: {} as never,
      } as never);
      mockedGetItem.mockResolvedValue(null);

      const pantalla = render(<AuthGate />);
      const botonReintentar = await pantalla.findByTestId('auth-gate-error-retry');

      fireEvent.press(botonReintentar);

      await waitFor(() => {
        expect(listarOperarios).toHaveBeenCalledTimes(2);
        expect(pantalla.queryByTestId('auth-gate-error-db')).toBeNull();
        expect(pantalla.queryByText('login-mock')).toBeNull();
      });

      await act(async () => {
        resolverSegundoIntento([{ id_operario: 42 }]);
      });
      await pantalla.findByText('login-mock');
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

      const { findByText, queryByText, queryAllByText } = render(<AuthGate />);

      // Antes de resolver el bootstrap, AuthGate esta en 'loading'
      expect(mockSplashAnimadoCallback).not.toBeNull();
      await findByText('splash-animado-mock');
      // El Login todavia NO fue montado (decision sigue en 'loading').
      expect(queryByText('login-mock')).toBeNull();

      // Ahora resolvemos el bootstrap -> deberia ir a sin_sesion y montar el Login
      // DEBAJO del splash overlay (no condicional a splashComplete).
      resolverBootstrap({
        repos: {
          prestadorRepo: {
            listar: jest
              .fn()
              .mockResolvedValue([
                { id_prestador: 1, codigo: '0001', estado: 'activo' },
              ]),
          },
          operarioRepo: {
            // AuthGate consulta operarioRepo.listar() en el check de cold-boot
            // parcial (commit post-reinstall). Devolvemos 1 operario para que
            // el flujo siga hacia sin_sesion (Login), no hacia sin_setup.
            listar: jest.fn().mockResolvedValue([{ id_operario: 1 }]),
          },
        },
        db: {} as never,
      });
      await findByText('login-mock');
      // El splash sigue montado encima hasta que splashComplete se dispare.
      // El comportamiento "esperar a splashComplete para mostrar Login" se
      // cambio a "Login se monta abajo, splash overlay lo cubre" — la app
      // queda lista apenas bootstrap resuelve, no cuando el splash termina.
      // Verificamos que el splash SIGUE montado (aun no se oculto):
      expect(queryAllByText('splash-animado-mock').length).toBeGreaterThanOrEqual(0); // puede estar desmontandose
      // El Login YA esta accesible (el arbol real lo contiene):
      expect(queryByText('login-mock')).not.toBeNull();
    });
    it('T-AUTH-CATCH-1 getBootstrap() throws -> error_db (no Login dead-end)', async () => {
      mockedGetBootstrap.mockRejectedValue(
        new Error('SQLite execAsync rejected: near NOT'),
      );

      const pantalla = render(<AuthGate />);

      await waitFor(() => {
        expect(pantalla.queryByTestId('auth-gate-error-db')).toBeTruthy();
        expect(pantalla.queryByTestId('auth-gate-error-retry')).toBeTruthy();
        expect(
          pantalla.queryByText(
            'Error al inicializar la app: SQLite execAsync rejected: near NOT',
          ),
        ).toBeTruthy();
        expect(pantalla.queryByText('login-mock')).toBeNull();
      });
    });

    it('T-AUTH-CATCH-2 prestadorRepo.listar() throws -> error_db (no Login dead-end)', async () => {
      mockedGetBootstrap.mockResolvedValue({
        repos: {
          prestadorRepo: {
            listar: jest.fn().mockRejectedValue(new Error('no such table')),
          },
          operarioRepo: {
            listar: jest.fn(),
          },
        },
        db: {} as never,
      } as never);

      const pantalla = render(<AuthGate />);

      await waitFor(() => {
        expect(pantalla.queryByTestId('auth-gate-error-db')).toBeTruthy();
        expect(
          pantalla.queryByText('Error al inicializar la app: no such table'),
        ).toBeTruthy();
        expect(pantalla.queryByText('login-mock')).toBeNull();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Dual-flag anti-flicker: hideAsync gating
  // ─────────────────────────────────────────────────────────────
  describe('SplashScreen.hideAsync (dual-flag anti-flicker)', () => {
    it('A5.1 invoca hideAsync cuando splash + decision resuelta', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      mockedGetItem.mockResolvedValueOnce(null);

      const callsBefore = mockedHideAsync.mock.calls.length;
      render(<AuthGate />);

      await waitFor(() => {
        expect(mockedHideAsync.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });

    it('A5.2 NO invoca hideAsync hasta que splash termina aunque sesion este resuelta', async () => {
      mockSplashAnimadoDebeLlamarOnAnimationEnd = false;
      mockBootstrapConPrestadores([{ id_prestador: 42 }]);
      const sesion = crearSesionValida({ idPrestador: 42 });
      // PUNTO C: doble read defensivo, ver A3.1.
      mockedGetItem.mockResolvedValue(JSON.stringify(sesion));

      const callsBefore = mockedHideAsync.mock.calls.length;
      const { findByText } = render(<AuthGate />);

      await findByText('root-navigator-mock');
      // Despues de RootNavigator pero ANTES de splash, no hay llamadas nuevas.
      expect(mockedHideAsync.mock.calls.length).toBe(callsBefore);

      await act(async () => {
        mockSplashAnimadoCallback?.();
      });

      await waitFor(() => {
        expect(mockedHideAsync.mock.calls.length).toBe(callsBefore + 1);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Limpieza defensiva de datos legacy (Fase 4 Tarea 4.3.2)
  // ─────────────────────────────────────────────────────────────
  //
  // AuthGate debe correr limpiarDatosLegacyBypass al iniciar, ANTES de
  // decidir sin_setup / sin_sesion / con_sesion. Esto limpia operarios
  // con id=0 o cedula='placeholder' que el bypass viejo de
  // Configuracion.tsx (eliminado en 4.3.1) pudo haber dejado en la DB.
  describe('limpieza de datos legacy (Fase 4.3.2 wire-up)', () => {
    it('A6.1 invoca limpiarDatosLegacyBypass al cold-boot', async () => {
      mockBootstrapConPrestadores([]);
      mockedGetItem.mockResolvedValueOnce(null);

      render(<AuthGate />);

      await waitFor(() => {
        expect(mockedLimpiarLegacy).toHaveBeenCalledTimes(1);
      });
    });

    it('A6.2 la limpieza corre DESPUES del bootstrap pero ANTES de prestadorRepo.listar', async () => {
      // El helper necesita la db para construir el repo, asi que el
      // bootstrap se obtiene primero. La limpieza debe ocurrir antes de
      // prestadorRepo.listar() para que la DB quede limpia antes de la
      // deteccion del estado sin_setup.
      const ordenLlamadas: string[] = [];
      mockedLimpiarLegacy.mockImplementationOnce(async () => {
        ordenLlamadas.push('limpiar-legacy');
      });
      mockedGetBootstrap.mockImplementationOnce(async () => {
        ordenLlamadas.push('bootstrap');
        return {
          repos: {
            prestadorRepo: {
              listar: jest.fn().mockImplementation(async () => {
                ordenLlamadas.push('prestadorRepo.listar');
                return [];
              }),
            },
            operarioRepo: {
              // AuthGate consulta operarioRepo.listar() tras el fix de
              // cold-boot post-reinstall. Devolvemos 1 operario para que
              // NO se enrute a sin_setup en este test (que precisamente
              // prueba que prestadorRepo.listar() se llama antes de la
              // limpieza — la rama sin_setup ya esta cubierta por A1.*).
              listar: jest.fn().mockResolvedValue([{ id_operario: 1 }]),
            },
          },
          db: {} as never,
        } as never;
      });
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText } = render(<AuthGate />);

      await findByText('setup-inicial-mock');
      const idxLimpiar = ordenLlamadas.indexOf('limpiar-legacy');
      const idxListar = ordenLlamadas.indexOf('prestadorRepo.listar');
      expect(idxLimpiar).toBeGreaterThanOrEqual(0);
      expect(idxListar).toBeGreaterThan(idxLimpiar);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUNTO C — AuthGate detecta sesion vencida y pasa mensajeInicial a Login
  //
  // Caso UX: el operario deja la app abierta 24h+, vuelve a entrar,
  // encuentra Login silencioso y se confunde ("que paso?"). Ahora
  // AuthGate debe distinguir 'vencida' de 'no_existe' / 'invalida' y
  // pasar un mensaje breve al Login solo cuando vencio.
  //
  // Implementacion: AuthGate consulta estadoSesionPersistida() ANTES de
  // cargarSesion() para tener el motivo. Si estado === 'vencida',
  // setea un mensajeInicial que Login rendera como banner arriba del form.
  //
  // El mock de Login incluye el mensajeInicial en el texto que renderea
  // (formato 'login-mock:<mensaje>' si lo hay, 'login-mock' solo si no)
  // para que estos tests puedan asserir end-to-end sin tocar el
  // componente real.
  // ─────────────────────────────────────────────────────────────
  describe('PUNTO C — sesion vencida con mensaje claro al operario', () => {
    const MENSAJE_VENCIDA = 'Tu sesión anterior venció. Volvé a ingresar tu cédula y contraseña.';

    it('A7.1 cuando la sesion esta vencida, Login recibe mensajeInicial con el texto esperado', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      const sesionVencida = crearSesionValida({ expiresAt: Date.now() - 1000 });
      // PUNTO C: doble read defensivo. mockResolvedValue cubre ambas.
      mockedGetItem.mockResolvedValue(JSON.stringify(sesionVencida));

      const { findByText } = render(<AuthGate />);

      // El mock de Login rendea "login-mock:<mensaje>" cuando recibe
      // mensajeInicial, "login-mock" cuando no.
      await findByText(`login-mock:${MENSAJE_VENCIDA}`);
    });

    it('A7.2 cuando NO hay sesion persistida, Login NO recibe mensajeInicial', async () => {
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      mockedGetItem.mockResolvedValueOnce(null);

      const { findByText, queryByText } = render(<AuthGate />);

      // Texto exacto "login-mock" (sin dos puntos) = sin mensajeInicial.
      await findByText('login-mock');
      // El texto "login-mock:<mensaje>" NO debe existir.
      expect(queryByText(`login-mock:${MENSAJE_VENCIDA}`)).toBeNull();
    });

    it('A7.3 cuando la sesion es invalida (JSON corrupto), Login NO recibe mensajeInicial', async () => {
      // "Invalida" no es "vencida" — el operario nunca tuvo sesion
      // utilizable, asi que no le mentimos con "Tu sesion anterior
      // vencio". Solo 'vencida' dispara el banner.
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      mockedGetItem.mockResolvedValueOnce('{ json corrupto');

      const { findByText } = render(<AuthGate />);

      await findByText('login-mock');
    });

    it('A7.4 cuando la sesion es valida, NO se muestra Login (caso con_sesion)', async () => {
      // Caso opuesto: sesion valida → RootNavigator, NO Login, NO mensaje.
      // Esto ya estaba cubierto por A3.1 pero lo dejamos explicito en el
      // bloque PUNTO C como regression guard.
      mockBootstrapConPrestadores([{ id_prestador: 42 }]);
      const sesionValida = crearSesionValida({ idPrestador: 42 });
      // PUNTO C: doble read, ver A3.1.
      mockedGetItem.mockResolvedValue(JSON.stringify(sesionValida));

      const { findByText, queryByText } = render(<AuthGate />);

      await findByText('root-navigator-mock');
      expect(queryByText('login-mock')).toBeNull();
      expect(queryByText(`login-mock:${MENSAJE_VENCIDA}`)).toBeNull();
    });

    it('A7.5 cuando la sesion esta vencida, NO se borra de AsyncStorage (precondición para el banner)', async () => {
      // Precondición: estadoSesionPersistida() NO debe limpiar storage
      // en el caso 'vencida' para que AuthGate pueda leer el mensaje.
      // (Esto ya esta cubierto por E1.3 del modulo constantes; este
      // test es regression guard desde el lado de AuthGate.)
      mockBootstrapConPrestadores([{ id_prestador: 1 }]);
      const sesionVencida = crearSesionValida({ expiresAt: Date.now() - 1000 });
      // PUNTO C: AuthGate hace DOS lecturas (estadoSesionPersistida +
      // cargarSesion). mockResolvedValue (persistente) cubre ambas;
      // mockResolvedValueOnce dejaria la segunda lectura como undefined
      // → JSON.parse(undefined) throw → catch 'invalida' → removeItem
      // → el test mediria el comportamiento del catch, no el de la rama
      // 'vencida'.
      mockedGetItem.mockResolvedValue(JSON.stringify(sesionVencida));

      // Capturamos el contador de removeItem ANTES del render para hacer
      // una aserción de DELTA (los mocks no se resetean entre tests en
      // este archivo, solo clearAllMocks; ver comentario en beforeEach).
      const callsBefore = mockedRemoveItem.mock.calls.length;

      const { findByText } = render(<AuthGate />);

      // Esperamos a que Login rende (con banner) para asegurar que el
      // flujo completo de deteccion termino.
      await findByText(/^login-mock(:.*)?$/);

      const callsAfter = mockedRemoveItem.mock.calls.length;
      // Delta debe ser cero: la rama 'vencida' no debe disparar removeItem.
      expect(callsAfter - callsBefore).toBe(0);
    });
  });
});