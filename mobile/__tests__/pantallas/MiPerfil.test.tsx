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

import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
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

jest.mock('../../src/composicion/useWorkspace', () => {
  // Store mockeado con shape completo (data + actions). Las acciones son
  // jest.fn() que los tests pueden inspeccionar via `useWorkspace.setState`
  // o usando `jest.requireMock('../../src/composicion/useWorkspace')` para
  // llegar al módulo y espiar las acciones globales. NOTA: las acciones
  // viven en `useWorkspace.getState()` en el store real; acá las exponemos
  // también en el objeto "estado" que devuelve el selector para que el
  // componente MiPerfil las pueda tomar via `useWorkspace((s) => s.setX)`.
  const acciones = {
    setParametrosVigentes: jest.fn(),
  };
  return {
    useWorkspace: jest.fn((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 0,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: null,
        cargando: false,
        ...acciones,
      }),
    ),
    __acciones: acciones,
  };
});

jest.mock('../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({
    db: {} as never,
    repos: {} as never,
    adapters: {} as never,
    services: {} as never,
  }),
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
    aps: null,
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

  //====================================================================
  // mi-perfil-redesign — Task 1 (impeccable craft)
  // Verificaciones programaticas de typography, layout, hierarchy y
  // touch targets. Companion tests al commit `refactor(mi-perfil):
  // apply impeccable craft`.
  //====================================================================

  /** Convierte un hex color (#RRGGBB) a [R, G, B] en 0..1. */
  function hexARgb01(hex: string): [number, number, number] {
    const limpio = hex.replace('#', '');
    const r = parseInt(limpio.slice(0, 2), 16) / 255;
    const g = parseInt(limpio.slice(2, 4), 16) / 255;
    const b = parseInt(limpio.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  /** Calcula la luminancia relativa sRGB (WCAG 2.x). */
  function luminanciaRelativa(hex: string): number {
    const [r, g, b] = hexARgb01(hex);
    const linear = (c: number): number =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  }

  /** Ratio de contraste WCAG entre dos hex colors. */
  function contrasteWcag(hexA: string, hexB: string): number {
    const lA = luminanciaRelativa(hexA);
    const lB = luminanciaRelativa(hexB);
    const claro = Math.max(lA, lB);
    const oscuro = Math.min(lA, lB);
    return (claro + 0.05) / (oscuro + 0.05);
  }

  /**
   * T-CRAFT-1 — El avatar debe medir 120px (no 96px) tras el rediseño.
   * Antes del refactor el avatar era 96px; ahora es 120px para mejor
   * jerarquía visual.
   */
  it('T-CRAFT-1 avatar mide 120px (no 96px)', () => {
    const { getByTestId } = renderMiPerfil();
    const avatar = getByTestId('avatar');
    const estilo = StyleSheet.flatten(avatar.props.style) as {
      width?: number;
      height?: number;
    };
    expect(estilo.width).toBe(120);
    expect(estilo.height).toBe(120);
  });

  /**
   * T-CRAFT-2 — El nombre del operario usa H1 con fontSize dentro del
   * rango de clamp permitido (≥ 24px, ≤ 96px). El valor exacto
   * depende del viewport (responsive clamp), pero debe caer dentro
   * del rango [24, 96] en el frame default de test (320x568).
   */
  it('T-CRAFT-2 nombre usa H1 con fontSize en rango [24, 96]', () => {
    const { getByTestId } = renderMiPerfil();
    const nombre = getByTestId('perfil-nombre');
    const estilo = StyleSheet.flatten(nombre.props.style) as {
      fontSize?: number;
    };
    expect(estilo.fontSize).toBeGreaterThanOrEqual(24);
    expect(estilo.fontSize).toBeLessThanOrEqual(96);
  });

  /**
   * T-CRAFT-3 — El botón "Cerrar sesión" tiene touch target ≥ 44px
   * (WCAG 2.5.5). Verificamos el minHeight efectivo del Pressable.
   * BotonPrimario.tamanoNormal ya tiene height: 56 — el assert es
   * una salvaguarda para futuros refactors.
   */
  it('T-CRAFT-3 botón cerrar-sesion tiene minHeight >= 44px', () => {
    const { getByTestId } = renderMiPerfil();
    const boton = getByTestId('boton-cerrar-sesion');
    const estilo = StyleSheet.flatten(boton.props.style) as {
      minHeight?: number;
      height?: number;
    };
    const alto = estilo.height ?? estilo.minHeight ?? 0;
    expect(alto).toBeGreaterThanOrEqual(44);
  });

  /**
   * T-CRAFT-4 — Contraste WCAG AA en el nombre del operario contra
   * el fondo de la surface. brandAzulOscuro (#093C5D) sobre
   * surfaceContainerLowest (#FFFFFF) da ~11.4:1 — muy por encima del
   * umbral 4.5:1 de body text en WCAG AA.
   */
  it('T-CRAFT-4 contraste WCAG AA: nombre del operario vs fondo', () => {
    const { getByTestId } = renderMiPerfil();
    const nombre = getByTestId('perfil-nombre');
    const estilo = StyleSheet.flatten(nombre.props.style) as {
      color?: string;
    };
    const colorTexto = estilo.color ?? '#000000';
    const contraste = contrasteWcag(colorTexto, '#FFFFFF');
    expect(contraste).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * T-CRAFT-5 — Ningún label de sección en MiPerfil debe tener
   * `textTransform: 'uppercase'`. Verificamos todos los nodos
   * `<Text>` del árbol renderizado y nos aseguramos de que ninguno
   * tenga ese estilo. La regla "ALL CAPS ban" de impeccable v1
   * lo deja explícito.
   */
  it('T-CRAFT-5 ningún Text renderizado tiene textTransform uppercase', () => {
    const { UNSAFE_queryAllByType } = renderMiPerfil();
    const textos = UNSAFE_queryAllByType(Text);
    expect(textos.length).toBeGreaterThan(0);
    for (const nodo of textos) {
      // StyleSheet.flatten(undefined) devuelve {} sin romper; los nodos
      // sin style quedan con textTransform undefined => no es 'uppercase'.
      const estilo = StyleSheet.flatten(nodo.props.style) as {
        textTransform?: string;
      } | null;
      const transform = estilo?.textTransform;
      expect(transform).not.toBe('uppercase');
    }
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
    const { useWorkspace, __acciones } = jest.requireMock(
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
        // Mantenemos las acciones mockeadas disponibles para que
        // MiPerfil no rompa al tomar `s.setParametrosVigentes`.
        setParametrosVigentes: __acciones.setParametrosVigentes,
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
   * T-MP-DATA-7 — Sección "Prestador actual" muestra el nombre REAL
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
   * sin poblar), la sección "Prestador actual" muestra "—".
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

describe('MiPerfil — T-REMOVE: sección Parámetros Tarifarios removida', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useWorkspace, __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    useWorkspace.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 42,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: null,
        cargando: false,
        setParametrosVigentes: __acciones.setParametrosVigentes,
      }),
    );
    mockedGetItem.mockResolvedValue(null);
  });

  // T-REMOVE-1: el texto "Parámetros tarifarios" (header de sección)
  // no debe existir en el árbol.
  it('T-REMOVE-1: no contiene texto "Parámetros tarifarios"', () => {
    const { queryByText } = renderMiPerfil();
    expect(queryByText(/Parámetros tarifarios/i)).toBeNull();
  });

  // T-REMOVE-2: el botón "Editar parámetros" (testID boton-editar-parametros)
  // no debe existir en el árbol.
  it('T-REMOVE-2: no contiene botón editar parámetros', () => {
    const { queryByTestId } = renderMiPerfil();
    expect(queryByTestId('boton-editar-parametros')).toBeNull();
  });

  // T-REMOVE-3: el modal de edición no debe existir (testID modal-cerrar
  // ausente del árbol). React Native Modal no monta sus children cuando
  // visible=false, así que este test sirve como regression guard: si
  // alguien re-introduce el Modal JSX sin abrirlo, este assert igual
  // pasa, pero si alguien intenta abrirlo, fallará.
  it('T-REMOVE-3: no contiene modal de edición (testID modal-cerrar ausente)', () => {
    const { queryByTestId } = renderMiPerfil();
    expect(queryByTestId('modal-cerrar')).toBeNull();
  });

  // T-REMOVE-4: los inputs del form de edición no deben existir
  // (testIDs param-cma, param-periodo). Mismo análisis que T-REMOVE-3:
  // sirve como regression guard.
  it('T-REMOVE-4: no contiene inputs del form (param-cma, param-periodo)', () => {
    const { queryByTestId } = renderMiPerfil();
    expect(queryByTestId('param-cma')).toBeNull();
    expect(queryByTestId('param-periodo')).toBeNull();
  });
});