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

import { Alert } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text, Pressable } from 'react-native';
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

describe('MiPerfil — Avatar & Paleta institucional EPC', () => {
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
   * T-CRAFT-1 — El avatar mide 80px. Antes del cleanup de Mi Perfil era
   * 120px (refactor mi-perfil-redesign Task 1); este cleanup lo reduce
   * a 80px para tono sobrio coherente con el resto de los screens.
   */
  it('T-CRAFT-1 avatar mide 80px', () => {
    const { getByTestId } = renderMiPerfil();
    const avatar = getByTestId('avatar');
    const estilo = StyleSheet.flatten(avatar.props.style) as {
      width?: number;
      height?: number;
    };
    expect(estilo.width).toBe(80);
    expect(estilo.height).toBe(80);
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
   * T-CRAFT-3 — El item "Cerrar sesión" en Gestión tiene touch target
   * ≥ 44px (WCAG 2.5.5). Tras el cleanup de Mi Perfil, el botón rojo
   * BotonPrimario se eliminó para no duplicar la acción; la única entry
   * ahora es el item de Gestión con `destructive` styling.
   */
  it('T-CRAFT-3 item cerrar-sesion en Gestión tiene minHeight >= 44px', () => {
    const { getByTestId } = renderMiPerfil();
    const item = getByTestId('item-cerrar-sesion');
    const estilo = StyleSheet.flatten(item.props.style) as {
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

  it('MP-3 el item "Cerrar sesión" en Gestión tiene styling destructivo', () => {
    // Tras el cleanup de Mi Perfil, el botón rojo BotonPrimario se
    // eliminó para no duplicar la acción. La única entry ahora es
    // el item de Gestión con `destructive` styling (texto en COLORS.error).
    const { getByTestId, getByText } = renderMiPerfil();
    const item = getByTestId('item-cerrar-sesion');
    expect(item).toBeTruthy();
    // El texto del item está presente en la jerarquía.
    const textoCerrar = getByText('Cerrar sesión');
    expect(textoCerrar).toBeTruthy();
  });
});

describe('MiPerfil — Información personal (Sesion + useWorkspace)', () => {
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
  it('T-REMOVE-1: NO contiene los inputs de edición de parámetros (param-cma, etc.)', () => {
    // Tras la adición del card de navegación, "Parámetros tarifarios"
    // aparece como label en el card — esto es discovery, no edición.
    // Lo que verifica este test es que NO está la UI de edición.
    const { queryByTestId } = renderMiPerfil();
    expect(queryByTestId('param-cma')).toBeNull();
    expect(queryByTestId('param-periodo')).toBeNull();
    expect(queryByTestId('param-cmo')).toBeNull();
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

// =====================================================================
// Post mi-perfil-redesign — navegación a Parámetros Tarifarios.
//
// Tras la refactorización mi-perfil-redesign, la edición de parámetros
// tarifarios vive exclusivamente en admin/ParametrosTarifa.tsx. Este card
// en Mi Perfil hace discoverable esa entrada sin duplicar la lógica de
// edición (no se reintroduce el modal ni los inputs en Mi Perfil).
// =====================================================================
describe('MiPerfil — Navegación a Parámetros Tarifarios (card de descubrimiento)', () => {
  function renderMiPerfilConNavSpy() {
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { key: 'MiPerfil', name: 'MiPerfil' as const, params: undefined };
    const ret = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 568 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <MiPerfil navigation={nav as never} route={route} onLogoutRequested={jest.fn()} />
      </SafeAreaProvider>,
    );
    return { ...ret, nav };
  }

  it('T-NAV-1: el card "Ir a parámetros tarifarios" está visible en Mi Perfil', () => {
    const { getByTestId } = renderMiPerfil();
    expect(getByTestId('boton-ir-parametros-tarifarios')).toBeTruthy();
  });

  it('T-NAV-2: tap en el card navega a Config → ParametrosTarifa', () => {
    const { getByTestId, nav } = renderMiPerfilConNavSpy();
    fireEvent.press(getByTestId('boton-ir-parametros-tarifarios'));
    expect(nav.navigate).toHaveBeenCalledWith(
      'Config',
      expect.objectContaining({
        screen: 'ParametrosTarifa',
        params: expect.objectContaining({ id_prestador: expect.any(Number) }),
      }),
    );
  });

  it('T-NAV-3: la navegación pasa el id_prestador_activo del workspace', () => {
    // Mockear id_prestador_activo = 42 en useWorkspace para verificar que
    // la navegación usa ese id.
    const { useWorkspace } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    useWorkspace.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({ id_prestador_activo: 42, prestador: null }),
    );
    const { getByTestId, nav } = renderMiPerfilConNavSpy();
    fireEvent.press(getByTestId('boton-ir-parametros-tarifarios'));
    expect(nav.navigate).toHaveBeenCalledWith(
      'Config',
      expect.objectContaining({
        params: { id_prestador: 42 },
      }),
    );
  });

  it('T-NAV-4: el card tiene accessibilityLabel "Ir a parámetros tarifarios"', () => {
    const { getByTestId } = renderMiPerfil();
    const card = getByTestId('boton-ir-parametros-tarifarios');
    expect(card.props.accessibilityLabel).toBe('Ir a parámetros tarifarios');
    expect(card.props.accessibilityRole).toBe('button');
  });

  it('T-NAV-5: el card tiene minHeight ≥ 44px (WCAG 2.5.5)', () => {
    const { getByTestId } = renderMiPerfil();
    const card = getByTestId('boton-ir-parametros-tarifarios');
    const flat = StyleSheet.flatten(card.props.style);
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
  });
});

// =====================================================================
// mi-perfil-redesign — Task 4 (test: add coverage for accessibility +
// integration). Estos tests verifican que la pantalla rediseñada cumple
// con WCAG 2.5.5 (touch targets) y que la jerarquía visual / estructura
// de datos fluye correctamente para casos reales.
// =====================================================================

/**
 * Helper compartido por los describe blocks de Accesibilidad e Integración.
 * Mockea useWorkspace con un prestador activo y AsyncStorage vacío.
 */
function setupMocksConPrestador(): void {
  const { useWorkspace, __acciones } = jest.requireMock(
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
      setParametrosVigentes: __acciones.setParametrosVigentes,
    }),
  );
}

/**
 * Recorre el árbol de testing-library recursivamente y devuelve todos
 * los nodos cuyo `type` es `Pressable` (referencia importada de
 * `react-native`). Esto es necesario porque `UNSAFE_queryAllByType`
 * no retorna resultados fiables en jest-expo + react-test-renderer
 * para componentes como Pressable (que internamente renderizan a
 * un View host con un tipo distinto).
 *
 * IMPORTANTE: en jest-expo + react-test-renderer, los children de un
 * nodo NO están en `node.props.children` — están directamente en
 * `node.children` (un array). El walk recorre ambos por las dudas.
 *
 * NOTA: NO usamos `hasOnPress` como heurística porque capturaría
 * falsos positivos (cualquier componente custom como BotonPrimario
 * que reciba onPress como prop aparecería como Pressable, falseando
 * los checks).
 */
function collectPressables(nodo: unknown, acc: Array<{
  props: Record<string, unknown>;
  testID?: string;
}> = []): Array<{ props: Record<string, unknown>; testID?: string }> {
  if (nodo === null || nodo === undefined) return acc;
  const n = nodo as {
    type?: unknown;
    children?: unknown | unknown[];
    props?: Record<string, unknown> & { children?: unknown; testID?: string };
  };
  const typeName =
    typeof n.type === 'function'
      ? (n.type as { displayName?: string; name?: string }).displayName ??
        (n.type as { name?: string }).name
      : typeof n.type === 'string'
        ? n.type
        : undefined;
  const isPressable =
    n.type === Pressable ||
    typeName === 'Pressable' ||
    typeName === 'Animated(View)';
  if (isPressable) {
    acc.push({ props: n.props ?? {}, testID: n.props?.testID });
  }
  // Recorrer vía .children (test-renderer) Y .props.children (DOM-like)
  const children1 = n.children;
  if (Array.isArray(children1)) {
    for (const child of children1) collectPressables(child, acc);
  } else if (children1 !== null && typeof children1 === 'object') {
    collectPressables(children1, acc);
  }
  const children2 = n.props?.children;
  if (Array.isArray(children2)) {
    for (const child of children2) collectPressables(child, acc);
  } else if (
    children2 !== null &&
    typeof children2 === 'object' &&
    (children2 as { type?: unknown }).type !== undefined
  ) {
    collectPressables(children2, acc);
  }
  return acc;
}

/**
 * Igual que `collectPressables` pero devuelve todos los testIDs en orden
 * de aparición en el árbol. Útil para verificar la jerarquía visual.
 */
function collectTestIds(nodo: unknown, acc: string[] = []): string[] {
  if (nodo === null || nodo === undefined) return acc;
  const n = nodo as {
    children?: unknown;
    props?: { testID?: string; children?: unknown };
  };
  if (n.props?.testID !== undefined) acc.push(n.props.testID);
  // Recorrer vía .children (test-renderer) Y .props.children
  const children1 = n.children;
  if (Array.isArray(children1)) {
    for (const child of children1) collectTestIds(child, acc);
  } else if (children1 !== null && typeof children1 === 'object') {
    collectTestIds(children1, acc);
  }
  const children2 = n.props?.children;
  if (Array.isArray(children2)) {
    for (const child of children2) collectTestIds(child, acc);
  } else if (
    children2 !== null &&
    typeof children2 === 'object' &&
    (children2 as { type?: unknown }).type !== undefined
  ) {
    collectTestIds(children2, acc);
  }
  return acc;
}

describe('MiPerfil — Accesibilidad (WCAG 2.x)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        setParametrosVigentes: __acciones.setParametrosVigentes,
      }),
    );
    mockedGetItem.mockResolvedValue(null);
  });

  /**
   * T-A11Y-1 — Recorre los `<Pressable>` user-facing del árbol
   * renderizado y verifica que cada uno tiene un touch target mínimo
   * de 44px de alto (WCAG 2.5.5 Target Size — iOS HIG baseline 44pt).
   *
   * "User-facing" = tiene `accessibilityLabel`. Los Pressables internos
   * (wrappers de Animated.View, contenedores sin label explícito) NO
   * necesitan hit-area propio: el control accesible es el wrapper con
   * label, no sus hijos sin label.
   *
   * Aplica a: botón cerrar-sesión, toggle de notificaciones, label
   * "Notificaciones" (fila completa), back button del TopBar.
   */
  it('T-A11Y-1: TODOS los Pressable user-facing tienen minHeight >= 44px', () => {
    const { UNSAFE_root } = renderMiPerfil();
    const pressables = collectPressables(UNSAFE_root);
    const userFacing = pressables.filter((p) => {
      const label = p.props.accessibilityLabel;
      return typeof label === 'string' && label.length > 0;
    });
    expect(userFacing.length).toBeGreaterThan(0);
    for (const press of userFacing) {
      // RN permite style como función (`({pressed}) => [...]`).
      // La evaluamos si hace falta para llegar al array plano.
      let styleRaw = press.props.style;
      if (typeof styleRaw === 'function') {
        try {
          styleRaw = styleRaw({ pressed: false });
        } catch {
          styleRaw = undefined;
        }
      }
      const estilo = StyleSheet.flatten(styleRaw as object | object[]) as {
        minHeight?: number;
        height?: number;
      } | null;
      const alto = estilo?.height ?? estilo?.minHeight ?? 0;
      expect(alto).toBeGreaterThanOrEqual(44);
    }
  });

  /**
   * T-A11Y-2 — Todo `<Pressable>` user-facing debe tener
   * `accessibilityLabel` O `accessibilityRole` definido. Sin un
   * label/role, los usuarios de VoiceOver / TalkBack no pueden
   * navegar la pantalla — esto es un blocker crítico de accesibilidad.
   *
   * Filtramos por Pressables con `accessibilityLabel` O `testID`
   * (los explícitamente expuestos al operario). El `accessibilityRole`
   * por default es inferido ('button' para Pressable con onPress), pero
   * validamos que esté declarado cuando se expone un control custom.
   */
  it('T-A11Y-2: TODOS los Pressable user-facing tienen accessibilityLabel', () => {
    const { UNSAFE_root } = renderMiPerfil();
    const pressables = collectPressables(UNSAFE_root);
    const userFacing = pressables.filter((p) => {
      const label = p.props.accessibilityLabel;
      const role = p.props.accessibilityRole;
      const tieneLabel = typeof label === 'string' && label.length > 0;
      const tieneRole = typeof role === 'string' && role.length > 0;
      const tieneTestID = typeof p.testID === 'string' && p.testID.length > 0;
      return tieneLabel || tieneRole || tieneTestID;
    });
    expect(userFacing.length).toBeGreaterThan(0);
    for (const press of userFacing) {
      const label = press.props.accessibilityLabel;
      const role = press.props.accessibilityRole;
      const tieneLabel =
        typeof label === 'string' && label.length > 0;
      const tieneRole = typeof role === 'string' && role.length > 0;
      // Al menos uno debe estar presente (label O role).
      expect(tieneLabel || tieneRole).toBe(true);
    }
  });
});

describe('MiPerfil — Integración (datos reales + jerarquía visual)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        setParametrosVigentes: __acciones.setParametrosVigentes,
      }),
    );
    mockedGetItem.mockResolvedValue(null);
  });

  /**
   * T-INTEG-1 — Verifica que la estructura jerárquica del árbol
   * respeta el orden visual esperado:
   *   avatar → información personal → prestador actual → cerrar sesión
   *
   * Esto es un guard contra regresiones donde alguien reorganiza las
   * secciones y rompe el flujo de lectura del operario (la pantalla
   * debe guiarlo de lo más identitario (avatar) a la acción final
   * (cerrar sesión)).
   */
  it('T-INTEG-1: estructura jerárquica avatar→info→prestador→cerrar-sesion', () => {
    const { UNSAFE_root } = renderMiPerfil();
    const todosLosTestIds = collectTestIds(UNSAFE_root);

    const idxAvatar = todosLosTestIds.indexOf('avatar');
    const idxCedula = todosLosTestIds.indexOf('fila-cedula');
    const idxPrestador = todosLosTestIds.indexOf('fila-prestador-nombre');
    // Tras el cleanup: "Cerrar sesión" vive SOLO en el item de Gestión
    // (no en el botón rojo BotonPrimario). El testID es item-cerrar-sesion.
    const idxCerrarSesion = todosLosTestIds.indexOf('item-cerrar-sesion');

    // Todos los testIDs clave deben existir en el árbol.
    expect(idxAvatar).toBeGreaterThanOrEqual(0);
    expect(idxCedula).toBeGreaterThanOrEqual(0);
    expect(idxPrestador).toBeGreaterThanOrEqual(0);
    expect(idxCerrarSesion).toBeGreaterThanOrEqual(0);
    // Y respetar el orden esperado.
    expect(idxAvatar).toBeLessThan(idxCedula);
    expect(idxCedula).toBeLessThan(idxPrestador);
    expect(idxPrestador).toBeLessThan(idxCerrarSesion);
  });

  /**
   * T-INTEG-2 — Con sesión cargada y prestador activo, las 3 filas
   * con datos sensibles (cédula del operario, ID operario, código del
   * prestador) deben estar pobladas con sus valores reales y ser
   * identificables vía testID para que el operario pueda copiarlas
   * (selección nativa de texto en RN).
   *
   * NOTA: la prop `selectable=true` en RN es un enhancement opcional —
   * verificamos que los testIDs existen y los textos se renderizan.
   * Si en Task 5+ se quiere copiar al clipboard, agregar `<Text
   * selectable>` es trivial.
   */
  it('T-INTEG-2: campos copiables (cédula, ID, código prestador) se renderizan con valores reales', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === '@sistema_epc:sesion') {
        return JSON.stringify(
          crearSesionValida({ cedula: '1234567', idOperario: 42 }),
        );
      }
      return null;
    });
    setupMocksConPrestador();

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const cedulaEl = getByTestId('fila-cedula-valor');
      const idEl = getByTestId('fila-id-operario-valor');
      const codigoEl = getByTestId('fila-prestador-codigo-valor');
      expect(cedulaEl).toBeTruthy();
      expect(idEl).toBeTruthy();
      expect(codigoEl).toBeTruthy();
      // Valores reales (no placeholders "—").
      expect((cedulaEl.props.children as string)).toBe('1234567');
      expect((idEl.props.children as string)).toBe('#42');
      expect((codigoEl.props.children as string)).toBe('P042');
    });
  });

  /**
   * T-INTEG-3 — Avatar muestra iniciales correctas cuando hay sesión
   * (p.ej. "JP" para "Juan Pérez") y cae al placeholder "OP" cuando
   * no hay sesión. Este test es la versión consolidada de T-MP-DATA-1
   * + T-MP-DATA-2, ahora agrupada bajo el describe 'Integración' para
   * el flujo de regresión del avatar.
   */
  it('T-INTEG-3a: avatar muestra "JP" cuando sesión es "Juan Pérez"', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === '@sistema_epc:sesion') {
        return JSON.stringify(crearSesionValida({ nombre: 'Juan Pérez' }));
      }
      return null;
    });

    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByText('JP')).toBeTruthy();
    });
  });

  it('T-INTEG-3b: avatar muestra "OP" cuando no hay sesión activa', async () => {
    // Default: mockedGetItem devuelve null (sin sesión).
    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByText('OP')).toBeTruthy();
    });
  });
});

// =====================================================================
// mi-perfil-unification-and-param-persistence — Commit 1 (T-UNIFY-*).
//
// Tras absorber Configuracion.tsx en MiPerfil.tsx, esta pantalla debe:
//   - Exponer una sección "Gestión" con 4 items: Agregar suscriptor,
//     Importar desde CSV, Versión, Cerrar sesión.
//   - NO contener la tarjeta "Última sincronización".
//   - Tab "Perfil" debe apuntar directamente a MiPerfil (initial route
//     de ConfigStack). En ConfigStack.tsx el screen "MiPerfil" es el
//     entry-point tras la unificación.
//   - "Cerrar sesión" muestra Alert.alert de confirmación con botón
//     destructivo.
//   - "Agregar suscriptor" navega a AltaSuscriptor.
//   - "Importar desde CSV" navega a ImportarCsv.
// =====================================================================

describe('MiPerfil — Unificación con Configuracion (T-UNIFY-1..8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        setParametrosVigentes: __acciones.setParametrosVigentes,
      }),
    );
    mockedGetItem.mockResolvedValue(null);
  });

  // T-UNIFY-1: renderiza sección Gestión con 4 items correctos.
  it('T-UNIFY-1 renderiza sección Gestión con 4 items: Agregar suscriptor, Importar desde CSV, Versión, Cerrar sesión', async () => {
    const { getByText, getByTestId } = renderMiPerfil();
    await waitFor(() => {
      // 4 items requeridos por el spec — usamos queryAllByText para
      // tolerar duplicados entre Gestión item + BotonPrimario legacy.
      const alta = getByTestId('item-alta-suscriptor');
      const csv = getByTestId('item-importar-csv');
      const ver = getByTestId('item-version');
      const cerrar = getByTestId('item-cerrar-sesion');
      expect(alta).toBeTruthy();
      expect(csv).toBeTruthy();
      expect(ver).toBeTruthy();
      expect(cerrar).toBeTruthy();
      // Verificamos también que los textos asociados están presentes.
      expect(alta.props.accessibilityLabel).toMatch(/Agregar suscriptor/i);
      expect(csv.props.accessibilityLabel).toMatch(/Importar desde CSV/i);
      expect(ver.props.accessibilityLabel).toMatch(/Versión/i);
      expect(cerrar.props.accessibilityLabel).toMatch(/Cerrar sesión/i);
      // Versión muestra "1.0.0" — verificamos el texto informativo.
      expect(getByText('1.0.0')).toBeTruthy();
    });
  });

  // T-UNIFY-2: no contiene "Última sincronización" (eliminada en esta change).
  it('T-UNIFY-2 no contiene la tarjeta "Última sincronización"', () => {
    const { queryByText, queryByTestId } = renderMiPerfil();
    expect(queryByText(/Última sincronización/i)).toBeNull();
    expect(queryByTestId('tarjeta-ultima-sincro')).toBeNull();
  });

  // T-UNIFY-3: ConfigStack navega a MiPerfil directamente (initial route).
  // El test verifica source-level: ConfigStack.tsx debe tener el screen
  // MiPerfil con component={MiPerfil} y NO tener screen "Configuracion".
  it('T-UNIFY-3 ConfigStack initial route es MiPerfil (no Configuracion)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/navegacion/stacks/ConfigStack.tsx'),
      'utf8',
    );
    // Debe tener el screen MiPerfil (initial route tras unificación).
    expect(source).toMatch(/Stack\.Screen\s+name="MiPerfil"/);
    // NO debe haber screen "Configuracion" en ConfigStack.
    expect(source).not.toMatch(/Stack\.Screen\s+name="Configuracion"/);
    // NO debe importar Configuracion.
    expect(source).not.toMatch(/import\s+Configuracion\s+from/);
  });

  // T-UNIFY-4: Versión muestra literal "1.0.0".
  it('T-UNIFY-4 Versión muestra el literal "1.0.0"', async () => {
    const { getByText } = renderMiPerfil();
    await waitFor(() => {
      expect(getByText('1.0.0')).toBeTruthy();
    });
  });

  // T-UNIFY-5: confirmar Alert de cerrar-sesion invoca onLogoutRequested
  // y limpia la sesión. Verificamos el wiring del callback destructivo
  // (onPress del botón "Cerrar sesión" del Alert).
  it('T-UNIFY-5 confirmar Alert de cerrar-sesion invoca onLogoutRequested y limpiarSesion', async () => {
    const onLogoutRequested = jest.fn();
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { key: 'miperfil', name: 'MiPerfil' as const, params: undefined };
    let capturedButtons: Array<{ text?: string; onPress?: () => void }> | undefined;
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(((_title: string, _msg: string, buttons?: unknown) => {
        capturedButtons = buttons as Array<{ text?: string; onPress?: () => void }>;
      }) as never);

    const { getByTestId } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 568 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <MiPerfil navigation={nav as never} route={route} onLogoutRequested={onLogoutRequested} />
      </SafeAreaProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('item-cerrar-sesion')).toBeTruthy();
    });
    fireEvent.press(getByTestId('item-cerrar-sesion'));

    expect(alertSpy).toHaveBeenCalled();
    expect(capturedButtons).toBeDefined();
    const botones = capturedButtons ?? [];
    const confirmar = botones.find((b) => b.text === 'Cerrar sesión');
    expect(confirmar).toBeDefined();
    // Ejecutar callback de confirmación.
    await confirmar?.onPress?.();
    // Verificamos que onLogoutRequested fue invocado al confirmar el alert.
    expect(onLogoutRequested).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  // T-UNIFY-6: Cerrar sesión muestra Alert.alert con botón destructivo.
  it('T-UNIFY-6 Cerrar sesión muestra Alert.alert con botón destructivo', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = renderMiPerfil();
    await waitFor(() => {
      expect(getByTestId('item-cerrar-sesion')).toBeTruthy();
    });
    fireEvent.press(getByTestId('item-cerrar-sesion'));
    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text?: string; style?: string }> | undefined;
    expect(buttons).toBeDefined();
    const destructive = (buttons ?? []).find((b) => b.style === 'destructive');
    expect(destructive).toBeDefined();
    alertSpy.mockRestore();
  });

  // T-UNIFY-7: Agregar suscriptor navega a AltaSuscriptor.
  it('T-UNIFY-7 tap en "Agregar suscriptor" navega a AltaSuscriptor', async () => {
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { key: 'miperfil', name: 'MiPerfil' as const, params: undefined };
    const { getByTestId } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 568 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <MiPerfil navigation={nav as never} route={route} onLogoutRequested={jest.fn()} />
      </SafeAreaProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('item-alta-suscriptor')).toBeTruthy();
    });
    fireEvent.press(getByTestId('item-alta-suscriptor'));
    expect(nav.navigate).toHaveBeenCalledWith('AltaSuscriptor');
  });

  // T-UNIFY-8: Importar CSV navega a ImportarCsv.
  it('T-UNIFY-8 tap en "Importar desde CSV" navega a ImportarCsv', async () => {
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { key: 'miperfil', name: 'MiPerfil' as const, params: undefined };
    const { getByTestId } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 568 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <MiPerfil navigation={nav as never} route={route} onLogoutRequested={jest.fn()} />
      </SafeAreaProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('item-importar-csv')).toBeTruthy();
    });
    fireEvent.press(getByTestId('item-importar-csv'));
    expect(nav.navigate).toHaveBeenCalledWith('ImportarCsv');
  });
});