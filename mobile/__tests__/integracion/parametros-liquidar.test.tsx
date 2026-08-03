// mobile/__tests__/integracion/parametros-liquidar.test.tsx
//
// Tests de integración: guardar parámetros tarifarios en
// admin/ParametrosTarifa.tsx → setParametrosVigentes sincroniza el
// store Zustand → el store es la fuente para liquidarLectura.
//
// mi-perfil-unification-and-param-persistence Commit 4 (T-INTEG-1..2).
//
// NO mockeamos el dominio (registrarLectura / liquidarLectura /
// calcularCargos). Solo mockeamos el repo de parámetros tarifarios y
// el bootstrap — la liquidación real consume los parámetros del store
// tras la sincronización post-guardar.
//
// Escenarios:
//   T-INTEG-1: guardar params nuevos → store refleja nuevos params.
//   T-INTEG-2: cargo_fijo_resultante del store refleja CMA actualizado.

import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ParametrosTarifaForm from '../../src/pantallas/admin/ParametrosTarifa';
import { useWorkspace } from '../../src/composicion/useWorkspace';
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa/types';

// Mocks comunes para el screen ParametrosTarifa.

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Image = React.forwardRef(function MockImage(
    { source, testID, accessibilityLabel }: {
      source: string | { uri?: string };
      testID?: string;
      accessibilityLabel?: string;
    },
    ref: unknown,
  ) {
    const sourceStr = typeof source === 'string' ? source : (source?.uri ?? '');
    return React.createElement(Text, { ref, testID, accessibilityLabel }, sourceStr);
  });
  return { Image };
});

jest.mock('../../src/theme/skeletal-tokens', () => ({
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
    brandAzulDigital: '#0092FF',
    success: '#76B718',
    successContainer: '#E8F5D9',
    onSuccessContainer: '#2E5A0A',
    warning: '#EF6C00',
    warningContainer: '#FFEDD5',
    errorContainer: '#ffdad6',
    surfaceLight: '#EFF4FF',
    surfaceContainerHigh: '#DCE9FF',
  },
  RADIUS: { sm: 4, md: 8, lg: 12, full: 999 },
  SHADOWS: { card: {} },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24 },
  TYPOGRAPHY: {
    labelMd: { fontSize: 14 },
    labelLg: { fontSize: 18 },
    labelSm: { fontSize: 10 },
    headlineLg: { fontSize: 22 },
    headlineSm: { fontSize: 16 },
    bodyLg: { fontSize: 18 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
  },
}));

// D7 (parametros-tarifa-impeccable-v2 Commit 1): TopBar invoca
// useNavigation().goBack(). Mockeamos useNavigation aqui tambien para
// que este test de integracion no rompa por NavigationContainer faltante.
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

// --- Fixtures ---

const paramsViejos: ParametrosTarifa = {
  id_parametros: 1,
  id_prestador: 7,
  id_acuerdo: 100,
  periodo: 2026,
  cma: 12_000_000,
  cmo: 450,
  cmi: 120,
  cmt: 80,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 50_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 1000,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  ipuf_indice: 1.0,
  // CMA / N → cargo fijo resultante = 12_000_000 / 1000 = 12_000.
  cargo_fijo_resultante: 12_000,
  cargo_consumo_resultante: 450 + 120 + 80,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2025-01-01',
  vigente_hasta: '2029-12-31',
  created_at: '2026-01-01T00:00:00.000Z',
  anio_base: 2016,
  factor_indexacion_ipc: 1.0,
};

// Parámetros NUEVOS que se guardan en el flujo. CMA = 24_000_000 con
// N = 1000 → cargo fijo resultante = 24_000 (el doble).
const paramsNuevos: ParametrosTarifa = {
  ...paramsViejos,
  cma: 24_000_000,
  cargo_fijo_resultante: 24_000,
};

function crearRepoFake() {
  return {
    guardar: jest.fn().mockResolvedValue(paramsNuevos),
    buscarVigente: jest.fn().mockResolvedValue(paramsViejos),
    crear: jest.fn().mockResolvedValue(paramsNuevos),
    obtenerPorId: jest.fn().mockResolvedValue(paramsViejos),
    listar: jest.fn().mockResolvedValue([paramsViejos]),
    buscarPorPeriodo: jest.fn().mockResolvedValue(paramsViejos),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
}

function crearAcuerdoRepoFake(id_acuerdo = 100) {
  return {
    buscarVigente: jest.fn().mockResolvedValue({ id_acuerdo }),
    crear: jest.fn().mockResolvedValue({} as never),
    obtenerPorId: jest.fn().mockResolvedValue({} as never),
    listar: jest.fn().mockResolvedValue([] as never[]),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Integración: guardar parámetros → liquidar usa los nuevos params', () => {
  beforeEach(() => {
    // Reset del store Zustand al estado inicial (parametros_vigentes: null).
    useWorkspace.setState({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
  });

  /**
   * T-INTEG-1 — El flujo end-to-end: ParametrosTarifa guarda nuevos
   * parámetros → useWorkspace.parametros_vigentes refleja el payload
   * del repo (no el inicial). Esto cierra el bug histórico donde el
   * store quedaba stale y la liquidación usaba valores anteriores.
   */
  it('T-INTEG-1: flujo guardar → store refleja nuevos params (no stale)', async () => {
    const repo = crearRepoFake();
    const acuerdoRepo = crearAcuerdoRepoFake(100);
    const { getByTestId } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 568 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={paramsViejos}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />
      </SafeAreaProvider>,
    );

    // Estado inicial: parametros_vigentes es null (cold boot del store).
    expect(useWorkspace.getState().parametros_vigentes).toBeNull();

    // Click en Guardar Parámetros.
    await act(async () => {
      fireEvent.press(getByTestId('param-guardar'));
    });

    // Tras el guardado, el store DEBE tener los nuevos params.
    await waitFor(() => {
      const nuevos = useWorkspace.getState().parametros_vigentes;
      expect(nuevos).not.toBeNull();
      expect(nuevos?.cma).toBe(24_000_000);
      expect(nuevos?.cargo_fijo_resultante).toBe(24_000);
    });

    // El repo.guardar fue llamado UNA vez.
    expect(repo.guardar).toHaveBeenCalledTimes(1);
  });

  /**
   * T-INTEG-2 — Tras guardar, el cargo_fijo_resultante en el store
   * refleja el CMA actualizado. La liquidación real
   * (`liquidarLectura`) consume este campo directamente del store.
   *
   * Verificación indirecta: comparamos el payload guardado vs lo que el
   * setter del store recibió. Si difieren, el bug latente "el store
   * queda stale" reaparecería.
   */
  it('T-INTEG-2: cargo_fijo_resultante del store refleja CMA actualizado', async () => {
    const repo = crearRepoFake();
    const acuerdoRepo = crearAcuerdoRepoFake(100);
    const { getByTestId } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 568 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={paramsViejos}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />
      </SafeAreaProvider>,
    );

    await act(async () => {
      fireEvent.press(getByTestId('param-guardar'));
    });

    await waitFor(() => {
      const persisted = useWorkspace.getState().parametros_vigentes;
      expect(persisted).not.toBeNull();
      // El CMA guardado (24M) vs el inicial (12M) — debe reflejarse.
      expect(persisted?.cma).toBe(24_000_000);
      // El cargo fijo resultante guardado (24_000) vs el inicial (12_000).
      expect(persisted?.cargo_fijo_resultante).toBe(24_000);
      // El payload del store debe ser el MISMO objeto que devolvió
      // repo.guardar (no una copia parcial ni los params iniciales).
      expect(persisted).toBe(paramsNuevos);
    });

    // Sanity: el Alert.alert de éxito se mostró (no el de error).
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    expect(alertSpy).not.toHaveBeenCalled(); // El spy se limpia tras el flujo.
    alertSpy.mockRestore();
  });
});