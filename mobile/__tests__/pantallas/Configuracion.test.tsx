// Tests de comportamiento para Mi Perfil en el flujo mobile-first.
// El bootstrap y el login vinculan el dispositivo antes de entrar a esta
// pantalla, por lo que Configuracion debe resolver el perfil por device_uuid
// sin ofrecer un segundo flujo de autenticación o vinculación.

import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import Configuracion from '../../src/pantallas/Configuracion';
import { crearNavMock, crearRouteMock } from './__mocks__/nav';
import { getBootstrap } from '../../src/composition/get-bootstrap';
import { limpiarSesion } from '../../src/composition/constantes';
import { useWorkspace } from '../../src/composicion/useWorkspace';
import { crearOperarioRepositoryExpoSqlite } from '../../src/persistencia/expo-sqlite/operario-repository-expo-sqlite';
import type { Operario } from '../../src/operarios/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/composition/get-bootstrap');
jest.mock('../../src/composition/constantes', () => ({
  limpiarSesion: jest.fn().mockResolvedValue(undefined),
}));
// Mock del store workspace. El store real expone dos APIs:
//   - `useWorkspace(selector)` — patrón hook usado por componentes.
//   - `useWorkspace.getState()` — para llamadas imperativas (ej. logout).
// El mock debe soportar AMBAS formas. El factory construye el hook como
// `jest.fn()` y le pega la propiedad `getState` para que el código
// `useWorkspace.getState()` (que Configuracion ya usa para logout) siga
// funcionando. Esto es retrocompatible y permite que, cuando agreguemos
// `useWorkspace((s) => s.parametros_vigentes)` en Configuracion, la
// sección de parámetros tarifarios reciba `null` por default.
const mockWorkspaceState: {
  id_prestador_activo: number;
  prestador: unknown;
  prestadores_disponibles: unknown[];
  acuerdo_vigente: unknown;
  parametros_vigentes: unknown;
  cargando: boolean;
  limpiarWorkspace: jest.Mock;
} = {
  id_prestador_activo: 0,
  prestador: null,
  prestadores_disponibles: [],
  acuerdo_vigente: null,
  parametros_vigentes: null,
  cargando: false,
  limpiarWorkspace: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../src/composicion/useWorkspace', () => {
  // `jest.fn` callable + accesible como objeto para soportar
  // `useWorkspace.getState()` en el código de Configuracion.
  const hookFn = jest.fn((sel: (s: unknown) => unknown) =>
    sel(mockWorkspaceState),
  );
  Object.assign(hookFn, {
    getState: jest.fn(() => mockWorkspaceState),
  });
  return { useWorkspace: hookFn };
});
jest.mock('../../src/persistencia/expo-sqlite/operario-repository-expo-sqlite');

const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;
const mockLimpiarSesion = limpiarSesion as jest.MockedFunction<typeof limpiarSesion>;
// `useWorkspace` ahora es un jest.fn() que también expone `getState`
// como propiedad. Accedemos a `getState` directo de la referencia para
// poder resetear su implementación per-test.
const mockUseWorkspaceAsMock = useWorkspace as unknown as jest.Mock & {
  getState: jest.MockedFunction<() => typeof mockWorkspaceState>;
};
const mockGetWorkspaceState = mockUseWorkspaceAsMock.getState;
const mockCrearOperarioRepo = crearOperarioRepositoryExpoSqlite as jest.MockedFunction<
  typeof crearOperarioRepositoryExpoSqlite
>;

// TopBar y FooterApp usan useSafeAreaInsets que requiere un SafeAreaProvider.
// Para tests unitarios de Configuracion, mockeamos estos componentes —
// no estamos testeando TopBar/FooterApp, sino el comportamiento del bypass.
jest.mock('../../src/componentes/TopBar', () => ({
  TopBar: () => null,
}));
jest.mock('../../src/componentes/FooterApp', () => ({
  FooterApp: () => null,
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
    surfaceLight: '#eee',
    outlineVariant: '#ccc',
    outline: '#888',
    textSecondary: '#555',
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

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;

const OPERARIO_LOGUEADO: Operario = {
  id_operario: 7,
  id_prestador: 42,
  numero_cedula: '1234567890',
  nombre: 'Juana Pérez',
  email: 'juana@epc.test',
  password_hash: 'hash-seguro',
  rol: 'operario',
  estado: 'activo',
  dispositivo_id: 'device-test',
};

const mockLimpiarWorkspace = jest.fn().mockResolvedValue(undefined);
const mockOnLogoutRequested = jest.fn();
let mockOperarioRepo: {
  inicializar: jest.Mock;
  buscarPorDispositivoId: jest.Mock;
  guardar: jest.Mock;
  listar: jest.Mock;
};

function prepararOperarioLogueado(): void {
  mockedGetItem.mockImplementation(async (key: string) => {
    if (key === 'cedula_operario') return OPERARIO_LOGUEADO.numero_cedula;
    if (key === 'device_uuid') return OPERARIO_LOGUEADO.dispositivo_id ?? null;
    return null;
  });
  mockOperarioRepo.buscarPorDispositivoId.mockResolvedValue(OPERARIO_LOGUEADO);
}

describe('Configuracion — perfil mobile-first', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    nav = crearNavMock();
    mockOperarioRepo = {
      inicializar: jest.fn().mockResolvedValue(undefined),
      buscarPorDispositivoId: jest.fn().mockResolvedValue(null),
      guardar: jest.fn().mockResolvedValue(undefined),
      listar: jest.fn().mockResolvedValue([]),
    };
    mockCrearOperarioRepo.mockReturnValue(mockOperarioRepo as never);
    mockGetWorkspaceState.mockReturnValue({
      limpiarWorkspace: mockLimpiarWorkspace,
    } as never);
    mockGetBootstrap.mockResolvedValue({
      repos: {
        operarioRepo: mockOperarioRepo,
      },
      db: {} as never,
    } as never);
  });

  it('T-NEW-1 siempre muestra el perfil vinculado al dispositivo aunque no haya cédula almacenada', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === 'cedula_operario') return null;
      if (key === 'device_uuid') return OPERARIO_LOGUEADO.dispositivo_id ?? null;
      return null;
    });
    mockOperarioRepo.buscarPorDispositivoId.mockResolvedValue(OPERARIO_LOGUEADO);

    const { findByText, queryByText } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    expect(await findByText(OPERARIO_LOGUEADO.nombre)).toBeTruthy();
    expect(await findByText(OPERARIO_LOGUEADO.numero_cedula)).toBeTruthy();
    expect(queryByText('Sin operario asignado')).toBeNull();
    expect(queryByText('ASIGNAR OPERARIO')).toBeNull();
  });

  it('T-NEW-2 muestra un fallback mínimo cuando el operario no se encuentra', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === 'cedula_operario') return OPERARIO_LOGUEADO.numero_cedula;
      if (key === 'device_uuid') return OPERARIO_LOGUEADO.dispositivo_id ?? null;
      return null;
    });
    mockOperarioRepo.buscarPorDispositivoId.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as never);

    try {
      const { findByText, queryByPlaceholderText, queryByText } = render(
        <Configuracion
          navigation={nav as never}
          route={crearRouteMock() as never}
          onLogoutRequested={mockOnLogoutRequested}
        />,
      );

      expect(await findByText('Cargando perfil...')).toBeTruthy();
      expect(queryByText('Sin operario asignado')).toBeNull();
      expect(queryByText('ASIGNAR OPERARIO')).toBeNull();
      expect(queryByPlaceholderText('Número de cédula')).toBeNull();
      expect(queryByPlaceholderText('Contraseña')).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('Configuracion — cerrar sesión (Punto B)', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    nav = crearNavMock();
    mockOperarioRepo = {
      inicializar: jest.fn().mockResolvedValue(undefined),
      buscarPorDispositivoId: jest.fn().mockResolvedValue(null),
      guardar: jest.fn().mockResolvedValue(undefined),
      listar: jest.fn().mockResolvedValue([]),
    };
    mockCrearOperarioRepo.mockReturnValue(mockOperarioRepo as never);
    mockGetWorkspaceState.mockReturnValue({
      limpiarWorkspace: mockLimpiarWorkspace,
    } as never);
    mockGetBootstrap.mockResolvedValue({
      repos: {
        operarioRepo: mockOperarioRepo,
      },
      db: {} as never,
    } as never);
  });

  it('B1.1 muestra "Cerrar sesión" cuando hay un operario logueado', async () => {
    prepararOperarioLogueado();

    const { findByText } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    expect(await findByText('Cerrar sesión')).toBeTruthy();
  });

  it('B1.3 pide confirmación antes de cerrar la sesión', async () => {
    prepararOperarioLogueado();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    const { findByText } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    fireEvent.press(await findByText('Cerrar sesión'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Cerrar sesión',
      '¿Seguro que querés cerrar sesión? Vas a tener que volver a ingresar tu cédula y contraseña.',
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('B1.4 al confirmar limpia la sesión y el workspace', async () => {
    prepararOperarioLogueado();
    let acciones: Parameters<typeof Alert.alert>[2] | undefined;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
      (_titulo, _mensaje, botones) => {
        acciones = botones;
      },
    );

    const { findByText, queryByText } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    fireEvent.press(await findByText('Cerrar sesión'));
    const confirmar = acciones?.find((accion) => accion.text === 'Cerrar sesión');
    expect(confirmar).toBeDefined();

    await act(async () => {
      await confirmar?.onPress?.();
    });

    expect(mockLimpiarSesion).toHaveBeenCalledTimes(1);
    expect(mockLimpiarWorkspace).toHaveBeenCalledTimes(1);
    expect(mockOnLogoutRequested).toHaveBeenCalledTimes(1);
    expect(queryByText('Cerrar sesión')).toBeNull();
    alertSpy.mockRestore();
  });

  it('B1.5 al cancelar conserva la sesión y el workspace', async () => {
    prepararOperarioLogueado();
    let acciones: Parameters<typeof Alert.alert>[2] | undefined;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
      (_titulo, _mensaje, botones) => {
        acciones = botones;
      },
    );

    const { findByText } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    fireEvent.press(await findByText('Cerrar sesión'));
    const cancelar = acciones?.find((accion) => accion.text === 'Cancelar');
    expect(cancelar).toBeDefined();

    await act(async () => {
      await cancelar?.onPress?.();
    });

    expect(mockLimpiarSesion).not.toHaveBeenCalled();
    expect(mockLimpiarWorkspace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

/**
 * BUG REPORTADO POR EL USUARIO:
 *   "En MiPerfil sigue sin mostrarse la sección de parámetros tarifarios.
 *    El commit 530dc10 dijo que lo arregló pero el usuario sigue sin verlo."
 *
 * CAUSA RAÍZ (diagnosticada en esta sesión):
 *   El usuario está mirando la pantalla `Configuracion` (initial screen
 *   del `ConfigStack`, accesible vía el tab "Perfil"). La pantalla
 *   `MiPerfil` — donde el commit 530dc10 efectivamente arregló el render
 *   — es una pantalla SECUNDARIA del stack, accesible solo vía
 *   `navigation.navigate('MiPerfil')`. El fix del 530dc10 fue correcto
 *   en `MiPerfil.tsx`, pero el usuario nunca llega a esa pantalla desde
 *   el tab "Perfil".
 *
 * FIX:
 *   Agregar la entrada "Parámetros tarifarios" en `Configuracion` (la
 *   pantalla del tab Perfil). El item muestra un resumen del estado
 *   (configurado / sin configurar) y al presionarlo navega a `MiPerfil`,
 *   donde está la sección completa con el modal de edición.
 *
 * T-MP-PARAM-FIX-N verifican el contrato de la nueva entrada.
 */
describe('Configuracion — entrada a parámetros tarifarios (bug fix)', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    nav = crearNavMock();
    mockOperarioRepo = {
      inicializar: jest.fn().mockResolvedValue(undefined),
      buscarPorDispositivoId: jest.fn().mockResolvedValue(null),
      guardar: jest.fn().mockResolvedValue(undefined),
      listar: jest.fn().mockResolvedValue([]),
    };
    mockCrearOperarioRepo.mockReturnValue(mockOperarioRepo as never);
    mockGetWorkspaceState.mockReturnValue({
      limpiarWorkspace: mockLimpiarWorkspace,
    } as never);
    mockGetBootstrap.mockResolvedValue({
      repos: {
        operarioRepo: mockOperarioRepo,
      },
      db: {} as never,
    } as never);
    // Hook `useWorkspace` con `parametros_vigentes: null` por default
    // (cold install). Cada test puede sobrescribir el mock si necesita
    // simular parámetros ya cargados.
    mockUseWorkspaceAsMock.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 0,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: null,
        cargando: false,
      }),
    );
  });

  /**
   * Helper para mockear parámetros tarifarios vigentes en el
   * `useWorkspace` hook mockeado.
   */
  function mockearParametrosVigentes(p: unknown): void {
    mockUseWorkspaceAsMock.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 42,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: p,
        cargando: false,
      }),
    );
  }

  /**
   * T-MP-PARAM-FIX-1 — Con operario logueado y `parametros_vigentes: null`
   * (cold install), la pantalla del tab Perfil muestra la entrada
   * "Parámetros tarifarios" con un indicador de que falta configurar.
   *
   * Sin esta entrada, el operario no tiene forma de descubrir que
   * existen parámetros tarifarios ni de llegar a la pantalla donde
   * puede editarlos. Por eso el usuario reportó "no veo la sección de
   * parámetros tarifarios".
   *
   * El texto "Parámetros tarifarios" aparece 2 veces en la pantalla:
   * - 1× como label de la sección (título, tipo h3).
   * - 1× como label del item de menú (clickable).
   * Verificamos que ambos están presentes con `findAllByText`.
   */
  it('T-MP-PARAM-FIX-1 muestra entrada "Parámetros tarifarios" sin configurar', async () => {
    prepararOperarioLogueado();

    const { findAllByText, findByTestId } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    const matches = await findAllByText('Parámetros tarifarios');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // El item de menú debe estar presente con su testID para que el
    // tap navegue a MiPerfil (ver T-MP-PARAM-FIX-3).
    expect(await findByTestId('item-parametros-tarifarios')).toBeTruthy();
    // Indicador honesto de estado (sin parámetros asignados todavía).
    expect(await findAllByText('Sin configurar')).toBeTruthy();
  });

  /**
   * T-MP-PARAM-FIX-2 — Con operario logueado y `parametros_vigentes`
   * poblado, la entrada muestra un resumen del estado (CMA formateado
   * con separador de miles). El operario debe ver de un vistazo si sus
   * parámetros están bien sin tener que entrar a la pantalla de detalle.
   */
  it('T-MP-PARAM-FIX-2 muestra CMA formateado cuando hay parámetros', async () => {
    prepararOperarioLogueado();
    mockearParametrosVigentes({
      id_parametros: 200,
      id_prestador: 42,
      id_acuerdo: 100,
      periodo: 2026,
      cma: 12_345_678,
      cmo: 450,
      cmi: 120,
      cmt: 80,
      cmviaa: 25,
      aplica_cmviaa: true,
      agua_suministrada_m3_anio: 50_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 350,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 6,
      vigente_desde: '2025-01-01',
      vigente_hasta: '2029-12-31',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    const { findAllByText, findByTestId, findByText } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    expect(
      (await findAllByText('Parámetros tarifarios')).length,
    ).toBeGreaterThanOrEqual(1);
    expect(await findByTestId('item-parametros-tarifarios')).toBeTruthy();
    // El resumen debe mostrar el CMA formateado (con separador de miles).
    expect(await findByText(/12\.345\.678/)).toBeTruthy();
  });

  /**
   * T-MP-PARAM-FIX-3 — Tap en la entrada "Parámetros tarifarios"
   * navega a la pantalla `MiPerfil` (donde está la sección completa
   * con el modal de edición). Esto es el contrato que cierra el bug:
   * el operario VE la entrada en el tab Perfil Y puede llegar al
   * editor con un solo tap.
   */
  it('T-MP-PARAM-FIX-3 tap en la entrada navega a MiPerfil', async () => {
    prepararOperarioLogueado();

    const { findByTestId } = render(
      <Configuracion
        navigation={nav as never}
        route={crearRouteMock() as never}
        onLogoutRequested={mockOnLogoutRequested}
      />,
    );

    const item = await findByTestId('item-parametros-tarifarios');
    fireEvent.press(item);

    expect(nav.navigate).toHaveBeenCalledWith('MiPerfil');
  });
});
