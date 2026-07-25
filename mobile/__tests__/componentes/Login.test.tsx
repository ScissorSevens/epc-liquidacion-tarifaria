// mobile/__tests__/componentes/Login.test.tsx
//
// Tests contractuales del Login real contra SQLite (TICKET-EPIC-LOGIN-001
// / PUNTO A — Fase 5 Tarea 5.2).
//
// REEMPLAZA el stub "modo demo" de Fase 4.2.3. El Login ahora valida
// cedula + password contra la DB local SQLite via `loginLocal()` y crea
// una Sesion multi-tenant con el idPrestador REAL del operario.
//
// COBERTURA:
//   - Happy path: cedula + password validas → loginLocal → guardarSesion
//     + useWorkspace.setSesionCompleta + onLoginSuccess.
//   - Validacion de inputs: cedula vacia / password < 8 → no llama
//     loginLocal ni side-effects.
//   - Errores tipados de loginLocal:
//       * OPERARIO_NO_ENCONTRADO → Alert "No encontramos un operario..."
//       * PASSWORD_INCORRECTA   → Alert "Contrasena incorrecta..."
//   - Error generico (DB caida, etc.) → Alert con mensaje user-friendly.
//   - Multi-tenant: la sesion persistida tiene idPrestador del operario
//     (NO hardcoded a 1).
//
// MOCKS:
//   - expo-splash-screen (silent preventAutoHide).
//   - AsyncStorage.
//   - theme tokens.
//   - getBootstrap: provee operarioRepo + hasher con stubs in-memory.
//   - loginLocal: spy jest.fn() que el test controla por caso.
//   - Alert.alert: spy para asserir que se llamo con titulo + mensaje.
//
// TDD Evidence:
//   RED  → estos tests son la primera implementacion del nuevo handler.
//          Antes de este commit, el archivo `composition/login-local.ts`
//          no existe. Los tests fallan al importarlo.
//   GREEN → el handler de Login.tsx usa loginLocal + los Alerts correctos
//          y los tests pasan.

import { Alert } from 'react-native';
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
    warning: '#f90',
    warningContainer: '#fff4e0',
    onWarningContainer: '#5a3500',
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

// Mock de loginLocal: el test controla lo que retorna / rechaza.
jest.mock('../../src/composition/login-local', () => ({
  loginLocal: jest.fn(),
  ERROR_OPERARIO_NO_ENCONTRADO: 'OPERARIO_NO_ENCONTRADO',
  ERROR_PASSWORD_INCORRECTA: 'PASSWORD_INCORRECTA',
}));

// Mock de getBootstrap: provee operarioRepo + hasher con stubs deterministas.
// Login.tsx solo usa estos dos del bootstrap; los demas son irrelevantes para
// el handler (AuthGate los consume en otra capa).
jest.mock('../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({
    operarioRepo: { buscarPorCedula: jest.fn() },
    hasher: { sha256: (s: string) => `sha256(${s})` },
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import Login from '../../src/pantallas/Login';
import { clave_storage_sesion } from '../../src/composition/constantes';
import { useWorkspace } from '../../src/composicion/useWorkspace';
import { loginLocal } from '../../src/composition/login-local';
import { COLORS } from '../../src/theme/skeletal-tokens';
import type { Sesion } from '../../src/composition/constantes';
import type { LoginLocalResultado } from '../../src/composition/login-local';

const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;
const mockedLoginLocal = loginLocal as jest.MockedFunction<typeof loginLocal>;

/** Sesion valida de un operario multi-tenant. idPrestador = 7 (NO hardcoded). */
const SESION_VALIDA: Sesion = {
  token: 'fake-token-12345',
  cedula: '51800012',
  nombre: 'Ana Lopez',
  idOperario: 42, // auditoria legal (CRA 825/2017) — obligatorio
  idPrestador: 7,
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
};

const RESULTADO_LOGIN_VALIDO: LoginLocalResultado = {
  sesion: SESION_VALIDA,
  operario: {
    id_operario: 42,
    id_prestador: 7,
    numero_cedula: '51800012',
    nombre: 'Ana Lopez',
    email: 'ana@test.com',
    password_hash: 'sha256(mi-clave)',
    rol: 'operario',
    estado: 'activo',
    created_at: '2024-01-15T00:00:00Z',
  },
};

describe('Login (PUNTO A — Login real contra SQLite)', () => {
  let onLoginSuccess: jest.Mock;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    onLoginSuccess = jest.fn();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useWorkspace.setState({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
    // Default del mock: login OK con sesion multi-tenant (idPrestador=7).
    mockedLoginLocal.mockResolvedValue(RESULTADO_LOGIN_VALIDO);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Happy path: handleIngresar con inputs validos + loginLocal OK
  // ──────────────────────────────────────────────────────────────────
  describe('handleIngresar con inputs validos y login OK', () => {
    it('L1.1 llama loginLocal con cedula trimmed + password y password_hash real', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '  51800012  ');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(mockedLoginLocal).toHaveBeenCalledTimes(1);
      });

      const args = mockedLoginLocal.mock.calls[0][0];
      // Login hace cedula.trim() antes de pasar al helper.
      expect(args.cedula).toBe('51800012');
      expect(args.password).toBe('mi-clave-secreta');
      // El helper debe recibir las deps operarioRepo + hasher (del bootstrap).
      expect(args.operarioRepo).toBeDefined();
      expect(args.hasher).toBeDefined();
    });

    it('L1.2 guarda la sesion con idPrestador real (NO hardcoded a 1) en AsyncStorage', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledTimes(1);
      });

      const escrituraSesion = mockedSetItem.mock.calls.find(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escrituraSesion).toBeDefined();

      const [, payload] = escrituraSesion as [string, string];
      const sesionGuardada = JSON.parse(payload) as Sesion;

      // Multi-tenant: idPrestador real del operario (7), NO 1.
      expect(sesionGuardada.idPrestador).toBe(7);
      expect(sesionGuardada.idPrestador).not.toBe(1);
      expect(sesionGuardada.cedula).toBe('51800012');
      expect(sesionGuardada.nombre).toBe('Ana Lopez');
      expect(sesionGuardada.token).toMatch(/^fake-token-/);
    });

    it('L1.3 sincroniza useWorkspace con sesion.idPrestador (7) via setSesionCompleta', async () => {
      const spySetSesion = jest.spyOn(useWorkspace.getState(), 'setSesionCompleta');
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(spySetSesion).toHaveBeenCalledTimes(1);
      });

      const sesionLlamada = spySetSesion.mock.calls[0][0] as Sesion;
      expect(sesionLlamada.idPrestador).toBe(7);
      expect(sesionLlamada.cedula).toBe('51800012');
    });

    it('L1.4 invoca onLoginSuccess exactamente una vez al terminar exitosamente', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('L1.5 NO muestra Alert.alert en el happy path (el login fue exitoso)', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledTimes(1);
      });

      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Validacion de inputs (sigue igual que el stub)
  // ──────────────────────────────────────────────────────────────────
  describe('handleIngresar con inputs invalidos', () => {
    it('L2.1 no llama loginLocal ni onLoginSuccess si cedula esta vacia', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await new Promise((r) => setTimeout(r, 20));

      expect(mockedLoginLocal).not.toHaveBeenCalled();
      expect(onLoginSuccess).not.toHaveBeenCalled();
      const escriturasConClaveSesion = mockedSetItem.mock.calls.filter(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escriturasConClaveSesion).toHaveLength(0);
    });

    it('L2.2 no llama loginLocal ni onLoginSuccess si contrasena < 8 chars', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'short');
      fireEvent.press(getByText('Ingresar'));

      await new Promise((r) => setTimeout(r, 20));

      expect(mockedLoginLocal).not.toHaveBeenCalled();
      expect(onLoginSuccess).not.toHaveBeenCalled();
      const escriturasConClaveSesion = mockedSetItem.mock.calls.filter(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escriturasConClaveSesion).toHaveLength(0);
    });

    it('L2.3 no llama loginLocal ni onLoginSuccess si cedula < 6 digitos', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '12345');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await new Promise((r) => setTimeout(r, 20));

      expect(mockedLoginLocal).not.toHaveBeenCalled();
      expect(onLoginSuccess).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Errores tipados de loginLocal → Alert con mensaje claro al usuario
  // ──────────────────────────────────────────────────────────────────
  describe('errores de loginLocal', () => {
    it('L3.1 OPERARIO_NO_ENCONTRADO → Alert "No encontramos un operario..." + NO onLoginSuccess', async () => {
      mockedLoginLocal.mockRejectedValueOnce(new Error('OPERARIO_NO_ENCONTRADO'));

      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '00000000');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      expect(onLoginSuccess).not.toHaveBeenCalled();
      // El Alert debe mencionar que no se encontro el operario (user-friendly,
      // no el codigo crudo).
      const argumentosAlert = alertSpy.mock.calls[0];
      const mensajeCompleto = argumentosAlert.slice(1).join(' ');
      expect(mensajeCompleto.toLowerCase()).toMatch(/no encontramos|operario|cédula|cedula/);
      // NO debe mencionar el codigo crudo OPERARIO_NO_ENCONTRADO (es para devs).
      expect(mensajeCompleto).not.toContain('OPERARIO_NO_ENCONTRADO');
    });

    it('L3.2 PASSWORD_INCORRECTA → Alert "Contrasena incorrecta..." + NO onLoginSuccess', async () => {
      mockedLoginLocal.mockRejectedValueOnce(new Error('PASSWORD_INCORRECTA'));

      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-equivocada');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      expect(onLoginSuccess).not.toHaveBeenCalled();
      const argumentosAlert = alertSpy.mock.calls[0];
      const mensajeCompleto = argumentosAlert.slice(1).join(' ');
      expect(mensajeCompleto.toLowerCase()).toMatch(/contrase|contrasena|incorrecta/);
      expect(mensajeCompleto).not.toContain('PASSWORD_INCORRECTA');
    });

    it('L3.3 error generico (DB caida) → Alert con mensaje user-friendly + NO onLoginSuccess', async () => {
      mockedLoginLocal.mockRejectedValueOnce(new Error('SQLITE BUSY'));

      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      expect(onLoginSuccess).not.toHaveBeenCalled();
      const argumentosAlert = alertSpy.mock.calls[0];
      const mensajeCompleto = argumentosAlert.slice(1).join(' ');
      // Mensaje user-friendly que SI puede mencionar el error tecnico (es OK
      // mostrar "SQLITE BUSY" porque es info util para soporte), pero DEBE
      // enmarcarlo en un contexto de "no se pudo iniciar sesion".
      expect(mensajeCompleto.toLowerCase()).toMatch(/no se pudo|iniciar sesión|iniciar sesion/);
    });

    it('L3.4 cuando loginLocal falla, NO se persiste sesion ni se sincroniza workspace', async () => {
      mockedLoginLocal.mockRejectedValueOnce(new Error('OPERARIO_NO_ENCONTRADO'));

      const spySetSesion = jest.spyOn(useWorkspace.getState(), 'setSesionCompleta');
      const { getByPlaceholderText, getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '00000000');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      expect(spySetSesion).not.toHaveBeenCalled();
      const escriturasConClaveSesion = mockedSetItem.mock.calls.filter(
        ([clave]) => clave === clave_storage_sesion,
      );
      expect(escriturasConClaveSesion).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // PUNTO C — Banner "Tu sesion anterior vencio" arriba del form
  //
  // Cuando AuthGate detecta que la sesion persistida esta vencida, le
  // pasa `mensajeInicial` a Login. Login debe:
  //   1. Mostrar el mensaje como banner amarillo arriba del form.
  //   2. Permitir dismissar el banner con un boton X (UX: no queremos
  //      forzar al operario a leer un mensaje que ya entendio).
  //
  // Si `mensajeInicial` es undefined (cold-boot limpio / invalida), el
  // banner NO debe aparecer — el Login rendea sin cambios.
  //
  // El mensaje es un prop "semilla": Login lo copia a state interno la
  // primera vez y despues el state es lo que controla la visibilidad.
  // Asi, si el operario toca X, el banner desaparece aunque el prop
  // siga siendo el mismo (re-render no lo revive).
  // ──────────────────────────────────────────────────────────────────
  describe('PUNTO C — banner de sesion vencida (mensajeInicial)', () => {
    const MENSAJE_VENCIDA =
      'Tu sesión anterior venció. Volvé a ingresar tu cédula y contraseña.';

    it('L4.1 muestra el banner con el mensajeInicial arriba del form', () => {
      const { getByText } = render(
        <Login onLoginSuccess={onLoginSuccess} mensajeInicial={MENSAJE_VENCIDA} />,
      );

      // El mensaje debe aparecer en algun lado del arbol.
      expect(getByText(MENSAJE_VENCIDA)).toBeTruthy();
    });

    it('L4.2 NO muestra banner cuando mensajeInicial es undefined', () => {
      const { queryByText } = render(
        <Login onLoginSuccess={onLoginSuccess} />,
      );

      // Sin prop mensajeInicial → sin banner → texto del mensaje ausente.
      expect(queryByText(MENSAJE_VENCIDA)).toBeNull();
    });

    it('L4.3 al tocar la X del banner, el mensaje se oculta (banner dismissable)', () => {
      const { getByText, queryByText, getByTestId } = render(
        <Login onLoginSuccess={onLoginSuccess} mensajeInicial={MENSAJE_VENCIDA} />,
      );

      // El mensaje esta visible al renderizar.
      expect(getByText(MENSAJE_VENCIDA)).toBeTruthy();

      // La X del banner es un Pressable con testID='banner-cerrar'
      // (presionar el Text interno del MaterialIcon no dispara el
      // onPress del Pressable contenedor; usamos el testID del wrapper).
      fireEvent.press(getByTestId('banner-cerrar'));

      // Despues de dismissar, el mensaje debe haber desaparecido del arbol.
      expect(queryByText(MENSAJE_VENCIDA)).toBeNull();
    });

    it('L4.4 el banner NO afecta el flujo de handleIngresar (login normal sigue funcionando)', async () => {
      // Regression guard: agregar el banner no debe romper el flujo de
      // login normal (happy path con banner visible).
      const { getByText, getByPlaceholderText } = render(
        <Login onLoginSuccess={onLoginSuccess} mensajeInicial={MENSAJE_VENCIDA} />,
      );

      // Banner visible.
      expect(getByText(MENSAJE_VENCIDA)).toBeTruthy();

      // Pero el form sigue accesible: tipeamos y submitimos.
      fireEvent.changeText(getByPlaceholderText('0.000.000-0'), '51800012');
      fireEvent.changeText(getByPlaceholderText('••••••••'), 'mi-clave-secreta');
      fireEvent.press(getByText('Ingresar'));

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Bloque 1 — craft UI: side-stripe BAN removal.
  //
  // impecable veta bordes laterales gruesos usados como acento coloreado
  // (borderLeft/Right > 1px sobre cards / banners / alerts). El banner
  // amarillo de sesion vencida tenia borderLeftWidth: 4 con
  // borderLeftColor: COLORS.warning — ese patron esta prohibido.
  //
  // Refactor: banner como "alert pill" con borde completo 1px + fondo
  // tinted. Misma semantica, sin stripe lateral.
  // ──────────────────────────────────────────────────────────────────
  describe('Bloque 1 craft UI — side-stripe BAN (banner amarillo)', () => {
    const MENSAJE =
      'Tu sesión anterior venció. Volvé a ingresar tu cédula y contraseña.';

    it('T-LOGIN-A1 el banner NO usa borderLeft como acento coloreado (veta impecable)', () => {
      const { getByTestId } = render(
        <Login onLoginSuccess={onLoginSuccess} mensajeInicial={MENSAJE} />,
      );
      const banner = getByTestId('banner');
      // El estilo mergeado no debe tener borderLeftWidth > 1 — la veta
      // impecable es contra "stripe de color" > 1px. Tener borderLeftWidth: 0
      // o no definido es OK; tener borderLeftWidth: 4 (lo que tenia antes)
      // NO esta permitido.
      expect(banner.props.style.borderLeftWidth).toBeUndefined();
    });

    it('T-LOGIN-A2 el banner usa borde completo 1px + fondo tinted de warningContainer', () => {
      const { getByTestId } = render(
        <Login onLoginSuccess={onLoginSuccess} mensajeInicial={MENSAJE} />,
      );
      const banner = getByTestId('banner');
      // El banner debe ser un "alert pill" moderno: borde uniforme + tint,
      // no stripe lateral.
      expect(banner.props.style.borderWidth).toBe(1);
      expect(banner.props.style.borderColor).toBe(COLORS.warning);
      expect(banner.props.style.backgroundColor).toBe(COLORS.warningContainer);
    });
  });
});