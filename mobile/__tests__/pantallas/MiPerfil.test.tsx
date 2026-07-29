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
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa/types';

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

/** Parámetros tarifarios vigentes del prestador activo (Res CRA 825/2017). */
function crearParametrosFixture(overrides: Partial<ParametrosTarifa> = {}): ParametrosTarifa {
  return {
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
    ipuf_indice: 1.0,
    cargo_fijo_resultante: 12_345_678 / 350,
    cargo_consumo_resultante: 450 + 120 + 80 + 25,
    componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
    minimo_vital: null,
    vigente_desde: '2025-01-01',
    vigente_hasta: '2029-12-31',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
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

describe('MiPerfil — parámetros tarifarios del prestador (TAREA 11 commit 2)', () => {
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
   * Helper: mockea useWorkspace con parámetros tarifarios vigentes.
   */
  function mockearParametros(p: ParametrosTarifa): void {
    const { useWorkspace, __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    useWorkspace.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 42,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: p,
        cargando: false,
        setParametrosVigentes: __acciones.setParametrosVigentes,
      }),
    );
  }

  /**
   * T-MP-PARAM-1 — Renderiza el título de la sección "Parámetros
   * tarifarios" cuando hay parámetros vigentes.
   */
  it('T-MP-PARAM-1 renderiza título de sección "Parámetros tarifarios"', async () => {
    mockearParametros(crearParametrosFixture());

    const { getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByText('Parámetros tarifarios')).toBeTruthy();
    });
  });

  /**
   * T-MP-PARAM-2 — Muestra el CMA (Costo Medio de Administración)
   * formateado. Es el campo más sensible del motor tarifario (CF = CMA/N
   * art. 9 Res CRA 825/2017).
   */
  it('T-MP-PARAM-2 muestra CMA formateado desde parametros_vigentes.cma', async () => {
    mockearParametros(crearParametrosFixture({ cma: 12_345_678 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      // El valor debe estar presente y NO ser el placeholder "—".
      const valorEl = getByTestId('fila-param-cma-valor');
      expect(valorEl).toBeTruthy();
      const texto = (valorEl.props.children as string) ?? '';
      expect(texto).not.toBe('—');
      // El formato debe incluir el separador de miles (independiente del
      // locale: punto o coma). El dato 12_345_678 contiene el separador
      // tras parsearlo.
      const digitos = texto.replace(/[^\d]/g, '');
      expect(digitos).toBe('12345678');
    });
  });

  /**
   * T-MP-PARAM-3 — Muestra CMO (Costo Medio de Operación por m³).
   */
  it('T-MP-PARAM-3 muestra CMO desde parametros_vigentes.cmo', async () => {
    mockearParametros(crearParametrosFixture({ cmo: 450 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-cmo-valor');
      expect(valorEl).toBeTruthy();
      const digitos = ((valorEl.props.children as string) ?? '').replace(/[^\d]/g, '');
      expect(digitos).toBe('450');
    });
  });

  /**
   * T-MP-PARAM-4 — Muestra CMI (Costo Medio de Inversión por m³).
   */
  it('T-MP-PARAM-4 muestra CMI desde parametros_vigentes.cmi', async () => {
    mockearParametros(crearParametrosFixture({ cmi: 120 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-cmi-valor');
      expect(valorEl).toBeTruthy();
      const digitos = ((valorEl.props.children as string) ?? '').replace(/[^\d]/g, '');
      expect(digitos).toBe('120');
    });
  });

  /**
   * T-MP-PARAM-5 — Muestra CMT (Costo Medio de Tasas Ambientales).
   */
  it('T-MP-PARAM-5 muestra CMT desde parametros_vigentes.cmt', async () => {
    mockearParametros(crearParametrosFixture({ cmt: 80 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-cmt-valor');
      expect(valorEl).toBeTruthy();
      const digitos = ((valorEl.props.children as string) ?? '').replace(/[^\d]/g, '');
      expect(digitos).toBe('80');
    });
  });

  /**
   * T-MP-PARAM-6 — Muestra CMVIAA (Costo Medio Variable de Inversiones
   * Ambientales Adicionales) cuando aplica_cmviaa=true.
   */
  it('T-MP-PARAM-6 muestra CMVIAA cuando aplica_cmviaa=true', async () => {
    mockearParametros(
      crearParametrosFixture({ aplica_cmviaa: true, cmviaa: 25 }),
    );

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-cmviaa-valor');
      expect(valorEl).toBeTruthy();
      const digitos = ((valorEl.props.children as string) ?? '').replace(/[^\d]/g, '');
      expect(digitos).toBe('25');
    });
  });

  /**
   * T-MP-PARAM-7 — Muestra el mínimo vital (m³) desde m3_gratis_minimo_vital.
   */
  it('T-MP-PARAM-7 muestra Mínimo vital desde m3_gratis_minimo_vital', async () => {
    mockearParametros(crearParametrosFixture({ m3_gratis_minimo_vital: 6 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-minimo-vital-valor');
      expect(valorEl).toBeTruthy();
      const digitos = ((valorEl.props.children as string) ?? '').replace(/[^\d]/g, '');
      expect(digitos).toBe('6');
    });
  });

  /**
   * T-MP-PARAM-8 — Muestra la vigencia (vigente_desde → vigente_hasta).
   */
  it('T-MP-PARAM-8 muestra vigencia desde vigente_desde y vigente_hasta', async () => {
    mockearParametros(
      crearParametrosFixture({
        vigente_desde: '2025-01-01',
        vigente_hasta: '2029-12-31',
      }),
    );

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const desdeEl = getByTestId('fila-param-vigente-desde-valor');
      const hastaEl = getByTestId('fila-param-vigente-hasta-valor');
      expect(desdeEl).toBeTruthy();
      expect(hastaEl).toBeTruthy();
      expect((desdeEl.props.children as string) ?? '').toBe('2025-01-01');
      expect((hastaEl.props.children as string) ?? '').toBe('2029-12-31');
    });
  });

  /**
   * T-MP-PARAM-9 — Sin parametros_vigentes (store sin poblar), toda la
   * sección cae al placeholder "—".
   */
  it('T-MP-PARAM-9 sin parámetros en store, todas las filas muestran "—"', async () => {
    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      // Solo verificamos que el título está y los valores son "—".
      expect(getByTestId('fila-param-cma-valor')).toBeTruthy();
      expect(
        (getByTestId('fila-param-cma-valor').props.children as string) ?? '',
      ).toBe('—');
      expect(
        (getByTestId('fila-param-vigente-hasta-valor').props.children as string) ?? '',
      ).toBe('—');
    });
  });
});

describe('MiPerfil — editar parámetros tarifarios vía modal (TAREA 11 commit 3)', () => {
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

  function mockearParametros(p: ParametrosTarifa): void {
    const { useWorkspace, __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    useWorkspace.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 42,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: p,
        cargando: false,
        setParametrosVigentes: __acciones.setParametrosVigentes,
      }),
    );
  }

  /**
   * T-MP-MODAL-1 — El botón "Editar" se muestra cuando hay parámetros
   * tarifarios vigentes en el store (es decir, el operario puede
   * editar lo que está viendo).
   */
  it('T-MP-MODAL-1 muestra botón Editar cuando hay parametros_vigentes', async () => {
    mockearParametros(crearParametrosFixture());

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });
  });

  /**
   * T-MP-MODAL-2 — Sin parametros_vigentes en store, el botón "Editar"
   * SÍ se muestra (el operario debe poder CREAR los parámetros desde
   * MiPerfil aunque el store no los tenga poblados — caso típico:
   * prestador activo pero sin parámetros tarifarios aún asignados).
   *
   * Bug arreglado en este commit: antes el botón estaba gated por
   * `parametros !== null`, lo que dejaba al operario con una sección
   * llena de "—" sin forma de configurar nada. El user reportó "no veo
   * cómo configurar los parámetros tarifarios".
   */
  it('T-MP-MODAL-2 sin parametros_vigentes, SÍ muestra botón Editar (para crear)', async () => {
    // mock default: parametros_vigentes = null
    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });
  });

  /**
   * T-MP-MODAL-9 — Sin parametros_vigentes previos, al presionar Editar
   * se abre el modal con valores por defecto razonables:
   *   - Costos medios (CMA, CMO, CMI, CMT, CMVIAA) en 0.
   *   - IPUF en 6 (constante normativa Res CRA 825/2017 art. 5).
   *   - Mínimo vital en 6 m³ (default del sistema).
   *   - Vigente desde = hoy, vigente hasta = +5 años (periodo tarifario).
   *   - aplica_cmviaa=false, aplica_minimo_vital=false (defaults seguros).
   *
   * Esto le permite al operario partir de un estado conocido y editar
   * solo lo que difiere del default, en vez de tener que tipear 12
   * campos desde cero.
   */
  it('T-MP-MODAL-9 sin parametros_vigentes, modal prellena con defaults normativos', async () => {
    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      // Costos medios en 0.
      expect((getByTestId('param-cma').props.value as string)).toBe('0');
      expect((getByTestId('param-cmo').props.value as string)).toBe('0');
      expect((getByTestId('param-cmi').props.value as string)).toBe('0');
      expect((getByTestId('param-cmt').props.value as string)).toBe('0');
      expect((getByTestId('param-cmviaa').props.value as string)).toBe('0');
      // IPUF = 6 (Res CRA 825/2017 art. 5).
      expect((getByTestId('param-ipuf').props.value as string)).toBe('6');
      // Mínimo vital = 6 m³ (default).
      expect((getByTestId('param-m3gratis').props.value as string)).toBe('6');
      // Vigente desde = hoy (YYYY-MM-DD).
      const hoy = new Date().toISOString().slice(0, 10);
      expect((getByTestId('param-vigente-desde').props.value as string)).toBe(hoy);
    });
  });

  /**
   * T-MP-MODAL-10 — Sin parametros_vigentes previos, al guardar el
   * modal crea un ParametrosTarifa NUEVO (con id_parametros=0 /
   * id_prestador del store) y lo inyecta en el store vía
   * `setParametrosVigentes`. La fila del MiPerfil pasa a mostrar el
   * valor editado (no "—").
   *
   * Esto cierra el ciclo: "ver sección con guiones" → "presionar
   * Editar" → "llenar form" → "Guardar" → "sección muestra datos".
   */
  it('T-MP-MODAL-10 guardar sin parametros_vigentes crea nuevo ParametrosTarifa en store', async () => {
    const { __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    __acciones.setParametrosVigentes.mockClear();

    const { getByTestId, getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      expect(getByTestId('param-cma')).toBeTruthy();
    });

    // Editamos el CMA desde 0 (default) a 5_000_000.
    fireEvent.changeText(getByTestId('param-cma'), '5000000');

    // Guardamos.
    fireEvent.press(getByTestId('param-guardar'));

    await waitFor(() => {
      expect(__acciones.setParametrosVigentes).toHaveBeenCalledTimes(1);
      const arg = __acciones.setParametrosVigentes.mock.calls[0]![0] as ParametrosTarifa;
      // El CMA editado se persiste.
      expect(arg.cma).toBe(5_000_000);
      // Los defaults se preservan.
      expect(arg.cmo).toBe(0);
      expect(arg.ipuf_m3_suscriptor_mes).toBe(6);
      expect(arg.m3_gratis_minimo_vital).toBe(6);
      // Flags por defecto.
      expect(arg.aplica_cmviaa).toBe(false);
      expect(arg.aplica_minimo_vital).toBe(false);
      // El modal se cerró.
      expect(() => getByText('Editar parámetros tarifarios')).toThrow();
    });
  });

  /**
   * T-MP-MODAL-3 — Presionar "Editar" abre el modal: aparece el título
   * del modal y los FormFields editables.
   */
  it('T-MP-MODAL-3 presionar Editar abre modal con FormField CMA', async () => {
    mockearParametros(crearParametrosFixture({ cma: 12_345_678 }));

    const { getByTestId, getByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      expect(getByText('Editar parámetros tarifarios')).toBeTruthy();
      // El FormField del CMA tiene testID='param-cma' y se propaga al
      // TextInput como testID={testID} (ver FormField.tsx).
      expect(getByTestId('param-cma')).toBeTruthy();
    });
  });

  /**
   * T-MP-MODAL-4 — El FormField del CMA se inicializa con el valor
   * actual del store (no vacío).
   */
  it('T-MP-MODAL-4 FormField CMA inicializa con valor del store', async () => {
    mockearParametros(crearParametrosFixture({ cma: 12_345_678 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      const input = getByTestId('param-cma');
      expect(input.props.value).toBe('12345678');
    });
  });

  /**
   * T-MP-MODAL-5 — Presionar "Guardar" actualiza el store vía
   * `setParametrosVigentes` con los valores del form, y cierra el
   * modal (el título desaparece).
   */
  it('T-MP-MODAL-5 Guardar actualiza el store y cierra el modal', async () => {
    const parametrosIniciales = crearParametrosFixture({ cma: 12_345_678 });
    mockearParametros(parametrosIniciales);

    // Obtenemos el setter mockeado (misma referencia que consume MiPerfil
    // via `useWorkspace((s) => s.setParametrosVigentes)`).
    const { __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    __acciones.setParametrosVigentes.mockClear();

    const { getByTestId, queryByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      expect(getByTestId('param-cma')).toBeTruthy();
    });

    // Cambiamos el valor del CMA en el form.
    fireEvent.changeText(getByTestId('param-cma'), '99999999');

    // Presionamos Guardar.
    fireEvent.press(getByTestId('param-guardar'));

    await waitFor(() => {
      // El setter fue invocado con el objeto mergeado.
      expect(__acciones.setParametrosVigentes).toHaveBeenCalledTimes(1);
      const arg = __acciones.setParametrosVigentes.mock.calls[0]![0] as ParametrosTarifa;
      expect(arg.cma).toBe(99_999_999);
      // El resto de campos se preservó.
      expect(arg.cmo).toBe(parametrosIniciales.cmo);
      expect(arg.id_parametros).toBe(parametrosIniciales.id_parametros);
      // El modal se cerró.
      expect(queryByText('Editar parámetros tarifarios')).toBeNull();
    });
  });

  /**
   * T-MP-MODAL-6 — Presionar "Cancelar" cierra el modal SIN invocar
   * `setParametrosVigentes` (el operario descartó la edición).
   */
  it('T-MP-MODAL-6 Cancelar cierra modal sin guardar', async () => {
    mockearParametros(crearParametrosFixture());

    const { __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    __acciones.setParametrosVigentes.mockClear();

    const { getByTestId, queryByText } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      expect(getByTestId('param-cancelar')).toBeTruthy();
    });

    fireEvent.press(getByTestId('param-cancelar'));

    await waitFor(() => {
      expect(__acciones.setParametrosVigentes).not.toHaveBeenCalled();
      expect(queryByText('Editar parámetros tarifarios')).toBeNull();
    });
  });

  /**
   * T-MP-MODAL-7 — El modal contiene FormFields para todos los
   * parámetros editables (CMA, CMO, CMI, CMT, CMVIAA, agua,
   * ipuf, suscriptores, mínimo vital, periodo, vigencia).
   */
  it('T-MP-MODAL-7 modal expone FormField para cada parametro editable', async () => {
    mockearParametros(crearParametrosFixture());

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      expect(getByTestId('param-cma')).toBeTruthy();
      expect(getByTestId('param-cmo')).toBeTruthy();
      expect(getByTestId('param-cmi')).toBeTruthy();
      expect(getByTestId('param-cmt')).toBeTruthy();
      expect(getByTestId('param-cmviaa')).toBeTruthy();
      expect(getByTestId('param-agua')).toBeTruthy();
      expect(getByTestId('param-ipuf')).toBeTruthy();
      expect(getByTestId('param-suscriptores')).toBeTruthy();
      expect(getByTestId('param-m3gratis')).toBeTruthy();
      expect(getByTestId('param-periodo')).toBeTruthy();
      expect(getByTestId('param-vigente-desde')).toBeTruthy();
      expect(getByTestId('param-vigente-hasta')).toBeTruthy();
    });
  });

  /**
   * T-MP-MODAL-8 — El botón "Editar" tiene touch target >= 44px
   * (WCAG 2.5.5). Verificamos el minHeight del Pressable.
   */
  it('T-MP-MODAL-8 botón Editar tiene touch target ≥ 44px', async () => {
    mockearParametros(crearParametrosFixture());

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const boton = getByTestId('boton-editar-parametros');
      expect(boton).toBeTruthy();
      const estilo = StyleSheet.flatten(boton.props.style) as {
        minHeight?: number;
        height?: number;
      };
      const alto = estilo.height ?? estilo.minHeight ?? 0;
      expect(alto).toBeGreaterThanOrEqual(44);
    });
  });
});

describe('MiPerfil — ParametrosTarifa completo (Res 825/2017): IPUF, cargos, componentes', () => {
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

  function mockearParametros(p: ParametrosTarifa): void {
    const { useWorkspace, __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    useWorkspace.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({
        id_prestador_activo: 42,
        prestador: null,
        prestadores_disponibles: [],
        acuerdo_vigente: null,
        parametros_vigentes: p,
        cargando: false,
        setParametrosVigentes: __acciones.setParametrosVigentes,
      }),
    );
  }

  /**
   * T-MP-IPUF-1 — La pantalla muestra `ipuf_indice` formateado cuando
   * hay parámetros vigentes. El IPUF (Índice de Precios al Usuario
   * Final) es un multiplicador decimal: 1.0 = sin ajuste, 1.05 = +5%.
   */
  it('T-MP-IPUF-1 muestra IPUF desde parametros_vigentes.ipuf_indice', async () => {
    mockearParametros(crearParametrosFixture({ ipuf_indice: 1.05 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-ipuf-valor');
      expect(valorEl).toBeTruthy();
      const texto = (valorEl.props.children as string) ?? '';
      // 1.05 → "1.05" o "1,05" según locale; validamos el numero.
      const num = parseFloat(texto.replace(',', '.'));
      expect(num).toBeCloseTo(1.05, 2);
    });
  });

  /**
   * T-MP-CARGO-FIJO-1 — El cargo fijo resultante se muestra con su
   * valor pre-calculado y persistido. El operario NO debe editarlo
   * (es derivado de CMA/N).
   */
  it('T-MP-CARGO-FIJO-1 muestra cargo_fijo_resultante desde parametros', async () => {
    mockearParametros(crearParametrosFixture({ cargo_fijo_resultante: 12_345 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-cargo-fijo-valor');
      expect(valorEl).toBeTruthy();
      const digitos = ((valorEl.props.children as string) ?? '').replace(/[^\d]/g, '');
      expect(digitos).toBe('12345');
    });
  });

  /**
   * T-MP-CARGO-CONSUMO-1 — El cargo por consumo resultante (COP / m³)
   * se muestra con su valor pre-calculado.
   */
  it('T-MP-CARGO-CONSUMO-1 muestra cargo_consumo_resultante desde parametros', async () => {
    mockearParametros(crearParametrosFixture({ cargo_consumo_resultante: 875 }));

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      const valorEl = getByTestId('fila-param-cargo-consumo-valor');
      expect(valorEl).toBeTruthy();
      const digitos = ((valorEl.props.children as string) ?? '').replace(/[^\d]/g, '');
      expect(digitos).toBe('875');
    });
  });

  /**
   * T-MP-COMPONENTES-1 — El modal de edición muestra un switch por
   * cada componente. Toggle debe reflejar si está en el array
   * `componentes_aplicables` del store.
   */
  it('T-MP-COMPONENTES-1 switches de componentes reflejando componentes_aplicables', async () => {
    mockearParametros(
      crearParametrosFixture({
        componentes_aplicables: ['CMA', 'CMO', 'CMI'],  // CMT y CMVIAA off
      }),
    );

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      const switchCma = getByTestId('switch-componente-CMA');
      const switchCmt = getByTestId('switch-componente-CMT');
      expect(switchCma).toBeTruthy();
      expect(switchCmt).toBeTruthy();
      expect(switchCma.props.value).toBe(true);
      expect(switchCmt.props.value).toBe(false);
    });
  });

  /**
   * T-MP-COMPONENTES-2 — Toggling un componente que está en el array
   * lo quita. El cargo_fijo_resultante debe recalcularse en vivo
   * (la UI muestra el preview, el guardado lo persiste).
   */
  it('T-MP-COMPONENTES-2 toggle de componente recalcula cargo_fijo_resultante en vivo', async () => {
    mockearParametros(
      crearParametrosFixture({
        cma: 12_000_000,
        suscriptores_promedio: 1000,
        componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      }),
    );

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    // Apertura del modal.
    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      expect(getByTestId('switch-componente-CMA')).toBeTruthy();
    });

    // CFO inicial = 12_000_000 / 1000 = 12_000 (visible).
    const cargoInicialEl = getByTestId('param-preview-cargo-fijo-valor');
    const cargoInicial = (cargoInicialEl.props.children as string) ?? '';
    expect(cargoInicial.replace(/[^\d]/g, '')).toBe('12000');

    // Toggle CMA off → cargo_fijo debe ir a 0.
    fireEvent(getByTestId('switch-componente-CMA'), 'valueChange', false);

    const cargoSinCmaEl = getByTestId('param-preview-cargo-fijo-valor');
    const cargoSinCma = (cargoSinCmaEl.props.children as string) ?? '';
    expect(cargoSinCma.replace(/[^\d]/g, '')).toBe('0');
  });

  /**
   * T-MP-IPUF-2 — El modal de edición expone un input numérico para
   * `ipuf_indice`. El default sin parametros previos es 1.0.
   */
  it('T-MP-IPUF-2 modal expone input numérico para IPUF', async () => {
    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      const input = getByTestId('param-ipuf-indice');
      expect(input).toBeTruthy();
      // Default sin parametros previos: 1.0.
      expect((input.props.value as string)).toBe('1');
    });
  });

  /**
   * T-MP-CARGO-PREVIEW-1 — El modal muestra un preview de los cargos
   * resultantes (calculados en vivo, no editables). Formato COP con
   * separador de miles.
   */
  it('T-MP-CARGO-PREVIEW-1 modal muestra preview de cargo_fijo_resultante', async () => {
    mockearParametros(
      crearParametrosFixture({
        cma: 12_000_000,
        suscriptores_promedio: 1000,
        componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      }),
    );

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      const preview = getByTestId('param-preview-cargo-fijo-valor');
      expect(preview).toBeTruthy();
      const texto = (preview.props.children as string) ?? '';
      expect(texto.replace(/[^\d]/g, '')).toBe('12000');
    });
  });

  /**
   * T-MP-CARGO-PREVIEW-2 — El modal muestra preview de cargo_consumo_resultante.
   */
  it('T-MP-CARGO-PREVIEW-2 modal muestra preview de cargo_consumo_resultante', async () => {
    mockearParametros(
      crearParametrosFixture({
        cmo: 500,
        cmi: 200,
        cmt: 100,
        cmviaa: 25,
        aplica_cmviaa: true,
        componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      }),
    );

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      const preview = getByTestId('param-preview-cargo-consumo-valor');
      expect(preview).toBeTruthy();
      const texto = (preview.props.children as string) ?? '';
      // 500 + 200 + 100 + 25 = 825.
      expect(texto.replace(/[^\d]/g, '')).toBe('825');
    });
  });

  /**
   * T-MP-GUARDAR-CARGOS-1 — Al guardar, los cargos pre-calculados se
   * persisten en el store via `setParametrosVigentes`. El modal
   * muestra los valores PRE-CALCULADOS con la formula del dominio
   * (CMA/N, CMO+CMI+CMT+CMVIAA).
   */
  it('T-MP-GUARDAR-CARGOS-1 guardar persiste cargos pre-calculados', async () => {
    const { __acciones } = jest.requireMock(
      '../../src/composicion/useWorkspace',
    );
    __acciones.setParametrosVigentes.mockClear();

    mockearParametros(
      crearParametrosFixture({
        cma: 12_000_000,
        suscriptores_promedio: 1000,
        cmo: 500,
        cmi: 200,
        cmt: 100,
        cmviaa: 25,
        aplica_cmviaa: true,
        componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
      }),
    );

    const { getByTestId } = renderMiPerfil();

    await waitFor(() => {
      expect(getByTestId('boton-editar-parametros')).toBeTruthy();
    });

    fireEvent.press(getByTestId('boton-editar-parametros'));

    await waitFor(() => {
      expect(getByTestId('param-guardar')).toBeTruthy();
    });

    fireEvent.press(getByTestId('param-guardar'));

    await waitFor(() => {
      expect(__acciones.setParametrosVigentes).toHaveBeenCalledTimes(1);
      const arg = __acciones.setParametrosVigentes.mock.calls[0]![0] as ParametrosTarifa;
      // Cargos pre-calculados con la formula del dominio.
      expect(arg.cargo_fijo_resultante).toBe(12_000);
      expect(arg.cargo_consumo_resultante).toBe(825);
    });
  });
});