// mobile/__tests__/pantallas/Sincronizacion.test.tsx
//
// Tests contractuales de la pantalla Sincronizacion con foco en la
// paleta institucional EPC:
//
//   - Iconos de success (check-circle de "Exitosos"): brandVerde (#76B718).
//   - Iconos de error (icon de "Fallidos"): error (rojo institucional).
//   - Iconos neutrales (pending de "Pendiente"): brandAzulOscuro
//     (#093C5D) — institucional sobre gris neutro; decision de craft
//     upgrade respecto al gris onSurfaceVariant previo.
//
// Los 3 stat cards ahora usan el componente reutilizable
// TarjetaMetrica (ver __tests__/componentes/TarjetaMetrica.test.tsx).
//
// Mockea:
//   - expo-splash-screen.
//   - AsyncStorage.
//   - theme tokens (con tokens institucionales).
//   - getBootstrap (apiBaseUrl + procesadorCola + colaRepo stubs).

import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 } },
  COLORS: {
    background: '#fff',
    surfaceContainerLowest: '#fff',
    surfaceVariant: '#dde',
    surfaceContainer: '#eef',
    surfaceContainerLow: '#eef',
    surfaceLight: '#eef',
    surfaceDim: '#ddd',
    primary: '#093C5D',
    onPrimary: '#fff',
    primaryContainer: '#1A2B48',
    secondary: '#0092FF',
    secondaryContainer: '#00CCF9',
    onSecondaryContainer: '#005266',
    onSurface: '#000',
    onSurfaceVariant: '#44474D',
    outline: '#888',
    outlineVariant: '#ccc',
    divider: '#ddd',
    error: '#D5212A',
    errorContainer: '#fee',
    placeholder: '#bbb',
    // Tokens institucionales EPC.
    brandVerde: '#76B718',
    brandRojo: '#D5212A',
    brandAzulOscuro: '#093C5D',
    brandAmarillo: '#FFDC26',
  },
  RADIUS: { full: 9999, md: 12, xl: 16, sm: 4 },
  SHADOWS: { card: {}, float: {} },
  SPACING: {
    margin: 16, lg: 24, md: 16, sm: 8, xs: 4, xl: 32, xxl: 48,
  },
  TYPOGRAPHY: {
    headlineLg: { fontSize: 28 },
    headlineMd: { fontSize: 22 },
    headlineSm: { fontSize: 18 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
    labelMd: { fontSize: 12 },
    labelLg: { fontSize: 14 },
    labelSm: { fontSize: 10 },
  },
}));

jest.mock('../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({
    adapters: {
      apiBaseUrl: 'http://localhost:3000',
    },
    services: {
      procesadorCola: jest.fn().mockResolvedValue({
        enviados: 0, conflictos: 0, fallidos: 0, pendientes: 0,
      }),
    },
    repos: {
      colaRepo: { listar: jest.fn().mockResolvedValue([]) },
    },
  }),
}));

// Mock local de MaterialIcons: propaga `name` y `color` como props del
// Text mockeado para poder inspeccionar el color en los tests. El mock
// global (__tests__/__mocks__/expo-vector-icons.js) no expone el color,
// solo el testID — insuficiente para asserts sobre la paleta institucional.
jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  function IconoMock(props: { name?: string; color?: string; testID?: string }) {
    return ReactLocal.createElement(
      Text,
      { testID: props.testID, name: props.name, color: props.color },
      props.name,
    );
  }
  IconoMock.default = IconoMock;
  return IconoMock;
});

// SyncStackScreenProps stub: Sincronizacion no navega a otra ruta en este test,
// asi que solo necesitamos `route` valido.
jest.mock('../../src/navegacion/types', () => ({
  SyncStackParamList: {},
  ConfigStackParamList: {},
}));

import Sincronizacion from '../../src/pantallas/Sincronizacion';
import type { SyncStackScreenProps } from '../../src/navegacion/types';
import type { ComponentProps, ReactElement } from 'react';

function crearProps(): ComponentProps<
  (props: SyncStackScreenProps<'Sincronizacion'>) => ReactElement
> {
  return {
    navigation: {
      navigate: jest.fn(),
      goBack: jest.fn(),
    } as never,
    route: { key: 'sync', name: 'Sincronizacion', params: undefined } as never,
  };
}

function renderSync() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <Sincronizacion {...crearProps()} />
    </SafeAreaProvider>,
  );
}

describe('Sincronizacion — paleta institucional EPC', () => {
  it('SY-1 el icono "check-circle" de Exitosos usa brandVerde (#76B718)', () => {
    const { getByTestId } = renderSync();
    // TarjetaMetrica setea testID={`${testID}-icon`}.
    const icono = getByTestId('stat-exitosos-icon');
    expect(icono.props.color).toBe('#76B718');
  });

  it('SY-2 el icono "error" de Fallidos mantiene COLORS.error (#D5212A = brandRojo)', () => {
    const { getByTestId } = renderSync();
    const icono = getByTestId('stat-fallidos-icon');
    expect(icono.props.color).toBe('#D5212A');
  });

  it('SY-3 el icono "pending" de Pendiente usa COLORS.brandAzulOscuro (upgrade de gris neutro a institucional)', () => {
    const { getByTestId } = renderSync();
    // Craft upgrade: variantes "normal" usan brandAzulOscuro en lugar del
    // gris onSurfaceVariant previo. Brand color con proposito semantico,
    // no reflex de neutral gris.
    const icono = getByTestId('stat-pendientes-icon');
    expect(icono.props.color).toBe('#093C5D');
  });
});