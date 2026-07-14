// mobile/__tests__/pantallas/Configuracion.test.tsx
//
// Tests de REGRESION para la pantalla `Configuracion` (Fase 4 Tarea 4.3.1).
//
// QUE CUBREN:
//   Verifican que el bypass viejo (que auto-creaba un operarioDummy con
//   id_operario=0 y numero_cedula='placeholder' cuando NO habia
//   cedulaGuardada) YA NO existe en el codigo.
//
//   Si alguien re-introduce ese bypass en el futuro, estos tests fallan
//   en el RED phase, evitando que la regresion llegue a produccion.
//
// ESTADO DEL BYPASS:
//   La pantalla Configuracion.tsx actual NO contiene el bypass (eliminado
//   antes de esta task — el summary del user estaba desactualizado).
//   Estos tests son la red de seguridad para que no vuelva.
//
// ESTRATEGIA:
//   - Mockeamos AsyncStorage para que 'cedula_operario' devuelva null.
//   - Mockeamos getBootstrap() con un operario repo espia.
//   - Renderizamos <Configuracion />.
//   - Verificamos:
//     * Render: muestra "Sin operario asignado" + formulario de asignacion.
//     * AsyncStorage: setItem con 'cedula_operario' NO fue llamado.
//     * Repo: guardar() NO fue llamado con id_operario=0 ni
//       numero_cedula='placeholder'.

import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import Configuracion from '../../src/pantallas/Configuracion';
import { crearNavMock, crearRouteMock } from './__mocks__/nav';
import { getBootstrap } from '../../src/composition/get-bootstrap';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/composition/get-bootstrap');
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

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
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

describe('Configuracion — regression del bypass eliminado (Fase 4.3.1)', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    nav = crearNavMock();
    // operarioRepo mockeado: nunca debe ser llamado en el camino "sin
    // cedula guardada" porque no hay nada que buscar.
    const operarioRepo = {
      inicializar: jest.fn().mockResolvedValue(undefined),
      buscarPorDispositivoId: jest.fn().mockResolvedValue(null),
      guardar: jest.fn().mockResolvedValue(undefined),
      listar: jest.fn().mockResolvedValue([]),
    };
    mockGetBootstrap.mockResolvedValue({
      operarioRepo,
      db: {} as never,
    } as never);
    // getItem default: NO hay cedula guardada, NO hay device UUID.
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === 'cedula_operario') return null;
      if (key === 'device_uuid') return null;
      return null;
    });
  });

  it('R1.1 muestra el formulario "Sin operario asignado" cuando no hay cedula guardada', async () => {
    const { findByText } = render(
      <Configuracion navigation={nav as never} route={crearRouteMock() as never} />,
    );

    await findByText(/Sin operario asignado/i);
    await findByText(/Ingresá tus credenciales/i);
  });

  it('R1.2 NO setea automaticamente "cedula_operario" en AsyncStorage sin input del usuario', async () => {
    render(
      <Configuracion navigation={nav as never} route={crearRouteMock() as never} />,
    );

    // Esperamos a que la pantalla termine su ciclo de carga (estado sin-operario).
    await waitFor(() => {
      // setItem con la clave 'cedula_operario' NO debe haber sido llamado.
      const escriturasCedula = mockedSetItem.mock.calls.filter(
        ([clave]) => clave === 'cedula_operario',
      );
      expect(escriturasCedula).toHaveLength(0);
    });
  });

  it('R1.3 NO crea un operario dummy en la DB con id_operario = 0 o cedula = "placeholder"', async () => {
    let guardarLlamado = false;
    // Mockeamos operarioRepo.guardar con un espia que detecta el bypass
    // si alguien lo re-introduce.
    const operarioRepo = {
      inicializar: jest.fn().mockResolvedValue(undefined),
      buscarPorDispositivoId: jest.fn().mockResolvedValue(null),
      guardar: jest.fn().mockImplementation((op: { id_operario?: number; numero_cedula?: string }) => {
        guardarLlamado = true;
        if (op.id_operario === 0) {
          throw new Error('REGRESION: operario creado con id_operario=0');
        }
        if (op.numero_cedula === 'placeholder') {
          throw new Error('REGRESION: operario creado con cedula=placeholder');
        }
        return Promise.resolve();
      }),
      listar: jest.fn().mockResolvedValue([]),
    };
    mockGetBootstrap.mockResolvedValue({
      operarioRepo,
      db: {} as never,
    } as never);

    render(
      <Configuracion navigation={nav as never} route={crearRouteMock() as never} />,
    );

    // Damos tiempo para que cualquier副作用 del bypass hipotetico ocurra.
    await new Promise((r) => setTimeout(r, 50));

    expect(guardarLlamado).toBe(false);
  });

  it('R1.4 NO llama a fetch al backend para auto-asignar cuando no hay cedula', async () => {
    // Si el bypass hace fetch a /api/v1/operarios sin autorizacion,
    // este test lo detecta (mock de fetch).
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as never);

    render(
      <Configuracion navigation={nav as never} route={crearRouteMock() as never} />,
    );

    await new Promise((r) => setTimeout(r, 50));

    // El flujo sin cedula debe corto-circuitear ANTES de fetch (linea 84-87
    // del componente). Si el bypass se re-introduce, fetch seria llamado.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});