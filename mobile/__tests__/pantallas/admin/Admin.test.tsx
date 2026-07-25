// mobile/__tests__/pantallas/admin/Admin.test.tsx
//
// Tests contractuales del Admin (pantalla de menú de administración).
// Cobertura:
//   - T-AD-RENDER-1: renderiza las 4 opciones de menú y el sub titulo.
//   - PER-05: selectores específicos en useWorkspace(). El componente
//     lee `id_prestador_activo` (para navegar con el id) y la acción
//     `cambiarPrestadorYCargarContexto`. Cambios en otros campos del
//     store NO deben disparar re-renders.
//
// Mocks:
//   - AsyncStorage, theme tokens, expo-splash-screen.
//   - get-bootstrap: retorna repos vacíos para que Admin no falle.
//   - @react-navigation/native: navigation stub.
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente.
//
// TDD Evidence:
//   RED  → primera cobertura directa de Admin.
//   GREEN → Tras el fix de selectores, los 4 tests pasan.

import { Profiler } from 'react';
import { render, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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

jest.mock('../../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 } },
  COLORS: {
    background: '#fff',
    primary: '#093C5D',
    onPrimary: '#fff',
    primaryContainer: '#1A2B48',
    warning: '#EF6C00',
    warningContainer: '#FFEDD5',
    secondary: '#0092FF',
    surfaceContainerLowest: '#fff',
    outlineVariant: '#ccc',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    // Tokens institucionales EPC (paleta institucional).
    brandAzulOscuro: '#093C5D',
    brandAzulDigital: '#0092FF',
    brandVerde: '#76B718',
    brandAmarillo: '#FFDC26',
    brandRojo: '#D5212A',
  },
  RADIUS: { sm: 4, md: 8, full: 999 },
  SHADOWS: { card: {} },
  SPACING: { xs: 4, sm: 8, md: 16 },
  TYPOGRAPHY: {
    labelMd: { fontSize: 14 },
    labelLg: { fontSize: 18 },
    headlineLg: { fontSize: 22 },
    headlineSm: { fontSize: 16 },
    headlineMd: { fontSize: 18 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
  },
}));

jest.mock('../../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({
    prestadorRepo: {
      obtenerPorId: jest.fn().mockResolvedValue(null),
    },
    acuerdoMunicipalRepo: {
      buscarVigente: jest.fn().mockResolvedValue(null),
    },
    parametrosTarifaRepo: {
      buscarVigente: jest.fn().mockResolvedValue(null),
    },
  }),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
  };
});

import { useWorkspace } from '../../../src/composicion/useWorkspace';
import Admin from '../../../src/pantallas/admin/Admin';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ConfigStackParamList } from '../../../src/navegacion/types';

/** Props mínimas para instanciar Admin en un test (sin stack real). */
function crearProps(): ComponentProps<
  (props: NativeStackScreenProps<ConfigStackParamList, 'Admin'>) => ReactElement
> {
  return {
    navigation: {
      navigate: jest.fn(),
      goBack: jest.fn(),
      // ... otros métodos que `navigation` pueda ofrecer en runtime
    } as never,
    route: { key: 'admin', name: 'Admin', params: undefined } as never,
  };
}

/** Estado base del store. */
const ESTADO_INICIAL = {
  id_prestador_activo: 0,
  prestador: null,
  prestadores_disponibles: [] as never[],
  acuerdo_vigente: null,
  parametros_vigentes: null,
  cargando: false,
};

describe('Admin', () => {
  beforeEach(() => {
    useWorkspace.setState(ESTADO_INICIAL);
  });

  // ─────────────────────────────────────────────────────────────
  // Render smoke — titulo y opciones de menú visibles.
  // ─────────────────────────────────────────────────────────────
  describe('render', () => {
    it('T-AD-RENDER-1 renderiza el titulo y las opciones del menú de administración', () => {
      useWorkspace.setState({
        prestadores_disponibles: [
          { id_prestador: 5, codigo: 'P005', nombre: 'A', nit: '', representante_legal: '', representante_legal_cedula: '', municipio: 'm', departamento: 'd', segmento: 2, num_suscriptores_urbanos: 0, num_suscriptores_rurales: 10, contacto: null, estado: 'activo', created_at: '', updated_at: '' } as never,
          { id_prestador: 7, codigo: 'P007', nombre: 'B', nit: '', representante_legal: '', representante_legal_cedula: '', municipio: 'm', departamento: 'd', segmento: 2, num_suscriptores_urbanos: 0, num_suscriptores_rurales: 10, contacto: null, estado: 'activo', created_at: '', updated_at: '' } as never,
        ],
        id_prestador_activo: 5,
      });
      const props = crearProps();
      const { getByText } = render(<Admin {...props} />);

      // Titulo.
      expect(getByText('Administración EPC')).toBeTruthy();
      // Las 4 opciones del menú.
      expect(getByText('Ver prestadores')).toBeTruthy();
      expect(getByText('Editar acuerdo')).toBeTruthy();
      expect(getByText('Configurar tarifas')).toBeTruthy();
      expect(getByText('Importar prestadores')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PER-05 — selectores específicos en useWorkspace()
  //
  // El componente lee `id_prestador_activo` (para navegar con el id
  // a AcuerdoMunicipal/ParametrosTarifa) y `cambiarPrestadorYCargarContexto`
  // (acción del store, llamada desde el handler del WorkspaceSwitcher).
  // Cambios en otros campos del store NO deben disparar re-renders.
  // ─────────────────────────────────────────────────────────────
  describe('PER-05 selectores específicos (no re-render en campos no usados)', () => {
    function contarUpdates(spy: jest.Mock): number {
      return spy.mock.calls.filter(([, phase]) => phase === 'update').length;
    }

    it('T-PER05-AD-1 NO se re-renderiza cuando cambia acuerdo_vigente (campo no usado)', () => {
      const props = crearProps();
      useWorkspace.setState({ id_prestador_activo: 5 });
      const spy = jest.fn();

      render(
        <Profiler id="admin" onRender={spy}>
          <Admin {...props} />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      act(() => {
        useWorkspace.setState({
          acuerdo_vigente: { id_acuerdo: 999, factor_subsidio_e1: -0.5 } as never,
        });
      });

      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });

    it('T-PER05-AD-2 NO se re-renderiza cuando cambia parametros_vigentes (campo no usado)', () => {
      const props = crearProps();
      useWorkspace.setState({ id_prestador_activo: 5 });
      const spy = jest.fn();

      render(
        <Profiler id="admin" onRender={spy}>
          <Admin {...props} />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      act(() => {
        useWorkspace.setState({
          parametros_vigentes: { id_parametros: 1, cma: 12345 } as never,
        });
      });

      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });

    it('T-PER05-AD-3 NO se re-renderiza cuando cambia prestador (campo no usado)', () => {
      const props = crearProps();
      useWorkspace.setState({ id_prestador_activo: 5 });
      const spy = jest.fn();

      render(
        <Profiler id="admin" onRender={spy}>
          <Admin {...props} />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      act(() => {
        useWorkspace.setState({
          prestador: { id_prestador: 5, codigo: 'X', nombre: 'X' } as never,
        });
      });

      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Paleta institucional EPC — cada item del submenú tiene un color
  // semánticamente coherente con la acción:
  //   - Ver prestadores: brandAzulOscuro (identidad).
  //   - Editar acuerdo + Configurar tarifas: brandAzulDigital (config).
  //   - Importar prestadores: brandVerde (agregar datos, semantica "agregar").
  // ─────────────────────────────────────────────────────────────
  describe('paleta institucional — colores semanticos del submenu', () => {
    it('AD-COLOR-1 "Ver prestadores" usa brandAzulOscuro (#093C5D) — identidad EPC', () => {
      useWorkspace.setState({ id_prestador_activo: 5 });
      const { getByTestId } = render(<Admin {...crearProps()} />);
      const item = getByTestId('menu-GestionPrestadores');
      const estilo = StyleSheet.flatten(item.props.style) as { backgroundColor?: string };
      expect(estilo.backgroundColor).toBe('#093C5D');
    });

    it('AD-COLOR-2 "Editar acuerdo" usa brandAzulDigital (#0092FF) — accion de configuracion', () => {
      useWorkspace.setState({ id_prestador_activo: 5 });
      const { getByTestId } = render(<Admin {...crearProps()} />);
      const item = getByTestId('menu-AcuerdoMunicipal');
      const estilo = StyleSheet.flatten(item.props.style) as { backgroundColor?: string };
      expect(estilo.backgroundColor).toBe('#0092FF');
    });

    it('AD-COLOR-3 "Configurar tarifas" usa brandAzulDigital (#0092FF) — accion de configuracion', () => {
      useWorkspace.setState({ id_prestador_activo: 5 });
      const { getByTestId } = render(<Admin {...crearProps()} />);
      const item = getByTestId('menu-ParametrosTarifa');
      const estilo = StyleSheet.flatten(item.props.style) as { backgroundColor?: string };
      expect(estilo.backgroundColor).toBe('#0092FF');
    });

    it('AD-COLOR-4 "Importar prestadores" usa brandVerde (#76B718) — semantica "agregar datos"', () => {
      useWorkspace.setState({ id_prestador_activo: 5 });
      const { getByTestId } = render(<Admin {...crearProps()} />);
      const item = getByTestId('menu-ImportarPrestadores');
      const estilo = StyleSheet.flatten(item.props.style) as { backgroundColor?: string };
      expect(estilo.backgroundColor).toBe('#76B718');
    });
  });
});
