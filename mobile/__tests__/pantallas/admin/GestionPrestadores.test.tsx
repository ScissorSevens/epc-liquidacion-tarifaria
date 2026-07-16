// mobile/__tests__/pantallas/admin/GestionPrestadores.test.tsx
//
// Tests contractuales del GestionPrestadores.
// Cobertura:
//   - T-GP-RENDER-1: renderiza la lista de prestadores cuando el repo
//     devuelve data.
//   - PER-05: selectores específicos en useWorkspace(). Suscripción
//     limitada a id_prestador_activo. Cambios en otros campos del
//     store NO deben disparar re-renders.
//
// Mocks:
//   - AsyncStorage, theme tokens, expo-splash-screen.
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente.
//   - @react-navigation/native: useNavigation stub.
//
// TDD Evidence:
//   RED  → primera cobertura directa de GestionPrestadores.
//   GREEN → Tras el fix de selectores, los 4 tests pasan.

import { Profiler } from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

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
    primary: '#031632',
    onPrimary: '#fff',
    primaryContainer: '#3596C8',
    surfaceContainerLowest: '#fff',
    outlineVariant: '#ccc',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    error: '#f00',
    errorContainer: '#fee',
    onErrorContainer: '#900',
    outline: '#999',
  },
  RADIUS: { sm: 4, md: 8, full: 999 },
  SHADOWS: { card: {} },
  SPACING: { xs: 4, sm: 8, md: 16 },
  TYPOGRAPHY: {
    labelMd: { fontSize: 14 },
    labelLg: { fontSize: 18 },
    headlineMd: { fontSize: 18 },
    headlineLg: { fontSize: 22 },
    headlineSm: { fontSize: 16 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
  },
}));

import { useWorkspace } from '../../../src/composicion/useWorkspace';
import GestionPrestadores from '../../../src/pantallas/admin/GestionPrestadores';
import type { Prestador } from '../../../../dominio/prestadores/types';

/** Prestador de fixture. */
const prestadorFixture: Prestador = {
  id_prestador: 5,
  codigo: 'P005',
  nombre: 'ASOCIACIÓN DE PRUEBA',
  nit: '900000005',
  representante_legal: 'Representante',
  representante_legal_cedula: '123456',
  municipio: 'Municipio Test',
  departamento: 'Departamento Test',
  segmento: 2,
  num_suscriptores_urbanos: 0,
  num_suscriptores_rurales: 100,
  contacto: null,
  estado: 'activo',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

/** Repo fake que devuelve la lista de fixtures. */
function crearRepoFake(override: Partial<{ listar: () => Promise<readonly Prestador[]>; suspender: (id: number) => Promise<void> }> = {}) {
  return {
    listar: override.listar ?? jest.fn().mockResolvedValue([prestadorFixture]),
    suspender: override.suspender ?? jest.fn().mockResolvedValue(undefined),
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

describe('GestionPrestadores', () => {
  beforeEach(() => {
    useWorkspace.setState(ESTADO_INICIAL);
  });

  // ─────────────────────────────────────────────────────────────
  // Render smoke — lista los prestadores cargados del repo.
  // ─────────────────────────────────────────────────────────────
  describe('render', () => {
    it('T-GP-RENDER-1 lista los prestadores devueltos por repo.listar()', async () => {
      const repo = crearRepoFake();
      const { getByText } = render(<GestionPrestadores repo={repo} />);

      await waitFor(() => {
        expect(getByText('ASOCIACIÓN DE PRUEBA')).toBeTruthy();
      });
      // Botones de acción visibles en cada card.
      expect(getByText('Acuerdo')).toBeTruthy();
      expect(getByText('Parámetros')).toBeTruthy();
      expect(getByText('Suspender')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PER-05 — selector específico en useWorkspace()
  //
  // El componente usa SOLO `id_prestador_activo` (para resaltar el
  // card del prestador activo). Cambios en otros campos NO deben
  // disparar re-renders.
  // ─────────────────────────────────────────────────────────────
  describe('PER-05 selectores específicos (no re-render en campos no usados)', () => {
    function contarUpdates(spy: jest.Mock): number {
      return spy.mock.calls.filter(([, phase]) => phase === 'update').length;
    }

    it('T-PER05-GP-1 NO se re-renderiza cuando cambia acuerdo_vigente (campo no usado)', () => {
      const repo = crearRepoFake();
      useWorkspace.setState({ id_prestador_activo: 5 });
      const spy = jest.fn();

      render(
        <Profiler id="gp" onRender={spy}>
          <GestionPrestadores repo={repo} />
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

    it('T-PER05-GP-2 NO se re-renderiza cuando cambia parametros_vigentes (campo no usado)', () => {
      const repo = crearRepoFake();
      useWorkspace.setState({ id_prestador_activo: 5 });
      const spy = jest.fn();

      render(
        <Profiler id="gp" onRender={spy}>
          <GestionPrestadores repo={repo} />
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

    it('T-PER05-GP-3 NO se re-renderiza cuando cambia prestador (campo no usado)', () => {
      const repo = crearRepoFake();
      useWorkspace.setState({ id_prestador_activo: 5 });
      const spy = jest.fn();

      render(
        <Profiler id="gp" onRender={spy}>
          <GestionPrestadores repo={repo} />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      act(() => {
        useWorkspace.setState({
          prestador: prestadorFixture,
        });
      });

      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });
  });
});
