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
jest.mock('../../src/composicion/useWorkspace', () => ({
  useWorkspace: { getState: jest.fn() },
}));
jest.mock('../../src/persistencia/expo-sqlite/operario-repository-expo-sqlite');

const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;
const mockLimpiarSesion = limpiarSesion as jest.MockedFunction<typeof limpiarSesion>;
const mockGetWorkspaceState = useWorkspace.getState as jest.MockedFunction<
  typeof useWorkspace.getState
>;
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
      operarioRepo: mockOperarioRepo,
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
      operarioRepo: mockOperarioRepo,
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
