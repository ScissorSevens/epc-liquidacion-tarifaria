// mobile/__tests__/pantallas/MiPerfil.test.tsx
//
// Tests contractuales de la pantalla MiPerfil con foco en la paleta
// institucional EPC:
//
//   - Avatar del operario usa brandAzulOscuro como fondo (identidad EPC)
//     + onPrimary blanco para el texto de las iniciales (contraste AAA).
//   - Botón "Cerrar sesión" (acción destructiva) usa brandRojo institucional
//     tanto en el texto como en el borde, NO el `error` genérico.
//
// Mocks:
//   - expo-splash-screen (silent preventAutoHide).
//   - AsyncStorage.
//   - theme tokens (con tokens institucionales EPC).
//   - getBootstrap stub para que composition/constantes.limpiarSesion no
//     explote si se llega a invocar.

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ComponentProps, ReactElement } from 'react';

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
    primary: '#093C5D', // mapeado a brandAzulOscuro
    onPrimary: '#fff',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    surfaceVariant: '#eef',
    surfaceDim: '#ddd',
    outlineVariant: '#ccc',
    secondary: '#0092FF',
    error: '#D5212A', // mapeado a brandRojo
    errorContainer: '#fee',
    // Tokens institucionales EPC.
    brandAzulOscuro: '#093C5D',
    brandRojo: '#D5212A',
  },
  RADIUS: { full: 9999, md: 12, xl: 16, sm: 4 },
  SHADOWS: { card: {} },
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

jest.mock('../../src/composicion/useWorkspace', () => ({
  useWorkspace: jest.fn((sel: (s: unknown) => unknown) =>
    sel({ id_prestador_activo: 0 }),
  ),
}));

jest.mock('../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({}),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  };
});

// AuthGate stub: MiPerfil NO depende de AuthGate pero si de la composición
// que limpia la sesión; dejamos getBootstrap mockeado arriba.

import MiPerfil from '../../src/pantallas/MiPerfil';
import type { ConfigStackScreenProps } from '../../src/navegacion/types';

/** Props mínimas para instanciar MiPerfil en un test. */
function crearProps(): ComponentProps<
  (props: ConfigStackScreenProps<'MiPerfil'> & {
    onLogoutRequested: () => void;
  }) => ReactElement
> {
  return {
    navigation: {
      navigate: jest.fn(),
      goBack: jest.fn(),
    } as never,
    route: { key: 'miperfil', name: 'MiPerfil', params: undefined } as never,
    onLogoutRequested: jest.fn(),
  };
}

/**
 * Renderiza MiPerfil envuelto en SafeAreaProvider porque TopBar y FooterApp
 * usan useSafeAreaInsets. initialMetrics default = 0 en todas las dimensiones.
 */
function renderMiPerfil() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <MiPerfil {...crearProps()} />
    </SafeAreaProvider>,
  );
}

describe('MiPerfil — paleta institucional EPC', () => {
  it('MP-1 el avatar usa brandAzulOscuro (#093C5D) como fondo', () => {
    const { getByTestId } = renderMiPerfil();
    const avatar = getByTestId('avatar');
    const estilo = StyleSheet.flatten(avatar.props.style) as {
      backgroundColor?: string;
    };
    expect(estilo.backgroundColor).toBe('#093C5D');
  });

  it('MP-2 el texto del avatar (iniciales) usa onPrimary (blanco) para contraste AAA', () => {
    const { getByText } = renderMiPerfil();
    const avatarText = getByText('OP');
    const estiloTexto = StyleSheet.flatten(avatarText.props.style) as {
      color?: string;
    };
    // El texto sobre brandAzulOscuro (#093C5D) debe ser blanco para AAA.
    expect(estiloTexto.color).toBe('#fff');
  });

  it('MP-3 el botón "Cerrar sesión" usa brandRojo (#D5212A) como color de texto', () => {
    const { getByText, getByTestId } = renderMiPerfil();
    const boton = getByTestId('boton-cerrar-sesion');
    // Buscamos el Text "Cerrar sesión" dentro del botón para inspeccionar su color.
    const textoBoton = getByText('Cerrar sesión');
    const estiloTexto = StyleSheet.flatten(textoBoton.props.style) as {
      color?: string;
    };
    expect(estiloTexto.color).toBe('#D5212A');
    expect(boton).toBeTruthy();
  });

  it('MP-4 el botón "Cerrar sesión" usa brandRojo (#D5212A) como color de borde', () => {
    const { getByTestId } = renderMiPerfil();
    const boton = getByTestId('boton-cerrar-sesion');
    // En @testing-library/react-native v13, props.style ya viene evaluado:
    // NO es la función ({pressed}) => [...] sino el array resuelto.
    const estilo = StyleSheet.flatten(boton.props.style) as { borderColor?: string };
    expect(estilo.borderColor).toBe('#D5212A');
  });
});