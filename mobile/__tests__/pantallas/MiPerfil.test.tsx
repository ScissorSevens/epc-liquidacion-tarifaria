// mobile/__tests__/pantallas/MiPerfil.test.tsx
//
// Tests contractuales de la pantalla MiPerfil con foco en:
//   1. Paleta institucional EPC (avatar + CTA destructivo).
//   2. Datos reales del operario + prestador desde Sesion / useWorkspace
//      (TAREA 11: reemplazar el PERFIL hardcoded por datos del store).
//   3. Parámetros tarifarios del prestador activo visibles y editables.
//
// Mocks:
//   - expo-splash-screen (silent preventAutoHide).
//   - AsyncStorage: getItem es jest.fn() para control per-test (default
//     resuelve null = "sin sesión" — equivale al comportamiento previo
//     donde la pantalla mostraba placeholders).
//   - theme tokens (con tokens institucionales EPC).
//   - getBootstrap stub para evitar que composition/constantes.limpiarSesion
//     explote si se llega a invocar.

import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ComponentProps, ReactElement } from 'react';

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
    background: '#fff',
    surfaceContainerLowest: '#fff',
    primary: '#093C5D', // mapeado a brandAzulOscuro
    onPrimary: '#fff',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    surfaceVariant: '#eef',
    surfaceDim: '#ddd',
    outlineVariant: '#ccc',
    outline: '#888',
    secondary: '#0092FF',
    error: '#D5212A', // mapeado a brandRojo
    errorContainer: '#fee',
    placeholder: '#bbb',
    surfaceContainerLow: '#eef',
    surface: '#fff',
    textSecondary: '#444',
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
    sel({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    }),
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import MiPerfil from '../../src/pantallas/MiPerfil';
import type { ConfigStackScreenProps } from '../../src/navegacion/types';
import type { Sesion } from '../../src/composition/constantes';
import type { Prestador } from '../../dominio/prestadores/types';

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;

/** Sesión válida de fixture — equivale al payload guardado por `guardarSesion`. */
function crearSesionValida(overrides: Partial<Sesion> = {}): Sesion {
  return {
    token: 'tok-' + 'b'.repeat(32),
    cedula: '1234567890',
    nombre: 'Juana Pérez',
    idOperario: 42,
    idPrestador: 42,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

/** Prestador activo de fixture — el que `useWorkspace.prestador` debería apuntar. */
function crearPrestadorFixture(): Prestador {
  return {
    id_prestador: 42,
    codigo: 'P042',
    nombre: 'ASOCIACIÓN DE USUARIOS LA VEREDA',
    nit: '900123456',
    representante_legal: 'Pedro Ramírez',
    representante_legal_cedula: '1234567890',
    municipio: 'Fusagasugá',
    departamento: 'Cundinamarca',
    segmento: 2,
    num_suscriptores_urbanos: 0,
    num_suscriptores_rurales: 250,
    contacto: null,
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

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
    // Sin sesion cargada, el fallback legacy muestra "OP" (placeholder
    // Operario). Color debe seguir siendo onPrimary (#fff) sobre
    // brandAzulOscuro para contraste AAA.
    const avatarText = getByText('OP');
    const estiloTexto = StyleSheet.flatten(avatarText.props.style) as {
      color?: string;
    };
    expect(estiloTexto.color).toBe('#fff');
  });

  it('MP-3 el botón "Cerrar sesión" usa brandRojo (#D5212A) como fondo (CTA destructivo filled)', () => {
    const { getByText, getByTestId } = renderMiPerfil();
    const boton = getByTestId('boton-cerrar-sesion');
    const estilo = StyleSheet.flatten(boton.props.style) as {
      backgroundColor?: string;
    };
    expect(estilo.backgroundColor).toBe('#D5212A');
    const textoBoton = getByText('Cerrar sesión');
    const estiloTexto = StyleSheet.flatten(textoBoton.props.style) as {
      color?: string;
    };
    expect(estiloTexto.color).toBe('#fff');
  });
});

describe('MiPerfil — datos reales del operario (Sesion + useWorkspace)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset del mock de useWorkspace al default (prestador null) ANTES
    // de cada test. Si no, `mockImplementation` aplicado en tests previos
    // persiste y filtra estado entre tests (ver T-MP-DATA-8 fallando
    // por arrastre del mock de T-MP-DATA-7).
    const { useWorkspace } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    useWorkspace.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 0,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: null,
        cargando: false,
      }),
    );
    // Default: AsyncStorage vacío → `cargarSesion()` resuelve null.
    mockedGetItem.mockResolvedValue(null);
  });

  /**
   * T-MP-DATA-1 — Avatar muestra iniciales derivadas del nombre real
   * de la sesión (no "OP" hardcoded). La pantalla hace `cargarSesion()`
   * en mount y vuelve a pintar cuando llega el resultado, por eso el
   * test usa `waitFor`.
   */
  it('T-MP-DATA-1 avatar muestra iniciales del nombre real cuando hay sesión', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === '@sistema_epc:sesion') {
        return JSON.stringify(crearSesionValida({ nombre: 'Juana Pérez' }));
      }
      return null;
    });

    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      // Juana Pérez → J + P (primera palabra + segunda) → "JP"
      expect(getByText('JP')).toBeTruthy();
    });
  });

  /**
   * T-MP-DATA-2 — Sin sesión, el avatar muestra el placeholder legacy
   * "OP" (Operario). No es un hardcode de UI real: es el fallback
   * honesto cuando AsyncStorage está vacío.
   */
  it('T-MP-DATA-2 sin sesión el avatar cae al placeholder "OP"', async () => {
    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByText('OP')).toBeTruthy();
    });
  });

  /**
   * T-MP-DATA-3 — El nombre mostrado en el header es `sesion.nombre`
   * real, no el literal "Operario" hardcoded.
   */
  it('T-MP-DATA-3 nombre del operario viene de sesion.nombre (no hardcoded)', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === '@sistema_epc:sesion') {
        return JSON.stringify(crearSesionValida({ nombre: 'Juana Pérez' }));
      }
      return null;
    });

    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByText('Juana Pérez')).toBeTruthy();
    });
  });

  /**
   * T-MP-DATA-4 — Sin sesión, el header de nombre muestra "—" (placeholder
   * honesto, no el literal "Operario" que era engañoso).
   */
  it('T-MP-DATA-4 sin sesión el nombre cae al placeholder "—"', async () => {
    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      // Verificamos el placeholder en el Text del header via testID —
      // `getByText('—')` no sirve porque hay varios "—" en el DOM
      // (teléfono, correo, prestador vacíos también caen a "—").
      const nombreEl = getByTestId('perfil-nombre');
      expect(nombreEl).toBeTruthy();
      expect(
        (nombreEl.props.children as string | string[]) ?? '',
      ).toBe('—');
    });
  });

  /**
   * T-MP-DATA-5 — El id del operario mostrado en la sección "Información
   * personal" viene de `sesion.idOperario`, no del literal "—".
   */
  it('T-MP-DATA-5 id del operario viene de sesion.idOperario', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === '@sistema_epc:sesion') {
        return JSON.stringify(crearSesionValida({ idOperario: 42 }));
      }
      return null;
    });

    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      // La pantalla formatea el id como "#42" para mayor claridad visual.
      expect(getByText('#42')).toBeTruthy();
    });
  });

  /**
   * T-MP-DATA-6 — La cédula del operario se muestra en la sección
   * "Información personal" cuando hay sesión activa.
   */
  it('T-MP-DATA-6 cédula del operario viene de sesion.cedula', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === '@sistema_epc:sesion') {
        return JSON.stringify(crearSesionValida({ cedula: '1234567890' }));
      }
      return null;
    });

    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByText('1234567890')).toBeTruthy();
    });
  });

  /**
   * T-MP-DATA-7 — Sección "Prestador activo" muestra el nombre REAL
   * del prestador desde `useWorkspace.prestador`. Si el store aún no
   * fue poblado (caso edge: MiPerfil abre antes que el WorkspaceSwitcher),
   * muestra "—" en vez de inventar un nombre.
   */
  it('T-MP-DATA-7 nombre del prestador viene de useWorkspace.prestador.nombre', async () => {
    const { useWorkspace } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    useWorkspace.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 42,
        prestador: crearPrestadorFixture(),
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: null,
        cargando: false,
      }),
    );

    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(
        getByText('ASOCIACIÓN DE USUARIOS LA VEREDA'),
      ).toBeTruthy();
    });
  });

  /**
   * T-MP-DATA-8 — Si useWorkspace.prestador es null (caso edge: store
   * sin poblar), la sección "Prestador activo" muestra "—".
   */
  it('T-MP-DATA-8 sin prestador en store, muestra placeholder "—"', async () => {
    // Mock default: prestador: null (no tocar)
    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      // Verificamos la fila específica del nombre del prestador via
      // testID. `getByText('—')` falla porque hay varios "—" en pantalla.
      const valorEl = getByTestId('fila-prestador-nombre-valor');
      expect(valorEl).toBeTruthy();
      expect(
        (valorEl.props.children as string | string[]) ?? '',
      ).toBe('—');
    });
  });
});