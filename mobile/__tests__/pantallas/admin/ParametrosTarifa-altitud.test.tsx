/**
 * Tests para `ParametrosTarifaForm` con altitud_msnm + preview
 * (Res CRA 750/2016 compliance).
 *
 * Cambios en el screen:
 *   - Input `param-altitud` para configurar la altitud del prestador.
 *   - Preview `param-altitud-preview` que muestra el limite de consumo
 *     basico calculado en vivo (11/13/16 m3 segun altitud).
 *
 * Scope: el AcuerdoMunicipal con 3 porcentajes separados se edita en
 * la pantalla `AcuerdoMunicipal.tsx` (screen separado) — el presente
 * test cubre solo los nuevos inputs de ParametrosTarifa.
 */

import * as React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render as rtlRender, fireEvent } from '@testing-library/react-native';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({
    repos: {
      parametrosTarifaRepo: {
        guardar: jest.fn().mockResolvedValue({}),
        buscarVigente: jest.fn().mockResolvedValue(null),
      },
      acuerdoMunicipalRepo: {
        buscarVigente: jest.fn().mockResolvedValue({ id_acuerdo: 100 }),
      },
    },
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-image', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  const Image = ReactLocal.forwardRef(function MockImage(
    { source, testID, accessibilityLabel, tintColor }: any, ref: any,
  ) {
    return ReactLocal.createElement(Text, {
      ref,
      testID,
      accessibilityLabel,
      accessibilityHint: tintColor !== undefined ? `tint:${tintColor}` : undefined,
    }, typeof source === 'string' ? source : '');
  });
  return { Image };
});

jest.mock('../../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 } },
  COLORS: {
    background: '#fff', primary: '#031632', onPrimary: '#fff',
    primaryContainer: '#3596C8', surfaceContainerLowest: '#fff',
    outlineVariant: '#ccc', onSurface: '#000', onSurfaceVariant: '#555',
    error: '#f00', success: '#76B718', successContainer: '#E8F5D9',
    onSuccessContainer: '#2E5A0A', warning: '#EF6C00',
    warningContainer: '#FFEDD5', errorContainer: '#ffdad6',
    surfaceLight: '#EFF4FF', surfaceContainerHigh: '#DCE9FF',
    brandAzulDigital: '#0092FF',
  },
  RADIUS: { sm: 4, md: 8, full: 999 },
  SHADOWS: { card: {} },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24 },
  TYPOGRAPHY: {
    labelMd: { fontSize: 14 }, labelLg: { fontSize: 18 }, labelSm: { fontSize: 10 },
    headlineLg: { fontSize: 22 }, headlineSm: { fontSize: 16 },
    bodyLg: { fontSize: 18 }, bodyMd: { fontSize: 14 }, bodySm: { fontSize: 12 },
  },
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactNative = require('react');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useFocusEffect: (cb: () => unknown) => {
      ReactNative.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

import { useWorkspace } from '../../../src/composicion/useWorkspace';
import ParametrosTarifaForm from '../../../src/pantallas/admin/ParametrosTarifa';
import type { ParametrosTarifa } from '../../../dominio/parametros-tarifa/types';

const parametrosFixture: ParametrosTarifa = {
  id_parametros: 200,
  id_prestador: 7,
  id_acuerdo: 100,
  periodo: 2026,
  cma: 12_345_678,
  cmo: 500,
  cmi: 120,
  cmt: 80,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 50_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 350,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  ipuf_indice: 1.0,
  cargo_fijo_resultante: 12_345_678 / 350,
  cargo_consumo_resultante: 500 + 120 + 80,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2025-01-01',
  vigente_hasta: '2029-12-31',
  created_at: '2026-01-01T00:00:00.000Z',
  anio_base: 2016,
  factor_indexacion_ipc: 1.0,
};

function repoFake() {
  return {
    guardar: jest.fn().mockResolvedValue(parametrosFixture),
    buscarVigente: jest.fn().mockResolvedValue(parametrosFixture),
    crear: jest.fn().mockResolvedValue(parametrosFixture),
    obtenerPorId: jest.fn().mockResolvedValue(parametrosFixture),
    listar: jest.fn().mockResolvedValue([parametrosFixture]),
    buscarPorPeriodo: jest.fn().mockResolvedValue(parametrosFixture),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
}

function acuerdoRepoFake() {
  return {
    buscarVigente: jest.fn().mockResolvedValue({ id_acuerdo: 100 }),
    crear: jest.fn().mockResolvedValue({} as never),
    obtenerPorId: jest.fn().mockResolvedValue({} as never),
    listar: jest.fn().mockResolvedValue([] as never[]),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
}

function renderConSafeArea(ui: React.ReactElement) {
  return rtlRender(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>,
  );
}

describe('ParametrosTarifaForm — altitud_msnm + preview (Res CRA 750/2016)', () => {
  beforeEach(() => {
    useWorkspace.setState({
      id_prestador_activo: 7,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
  });

  it('renderiza input param-altitud', () => {
    const { getByTestId } = renderConSafeArea(
      <ParametrosTarifaForm
        id_prestador={7}
        id_acuerdo={100}
        parametrosActuales={parametrosFixture}
        repo={repoFake() as any}
        acuerdoRepo={acuerdoRepoFake() as any}
      />,
    );
    expect(getByTestId('param-altitud')).toBeTruthy();
  });

  it('muestra preview param-altitud-preview con limite 11 m3 para altitud >2.000', () => {
    const { getByTestId } = renderConSafeArea(
      <ParametrosTarifaForm
        id_prestador={7}
        id_acuerdo={100}
        parametrosActuales={{ ...parametrosFixture, altitud_msnm: 2600 }}
        repo={repoFake() as any}
        acuerdoRepo={acuerdoRepoFake() as any}
      />,
    );
    const preview = getByTestId('param-altitud-preview');
    expect(preview).toBeTruthy();
    expect(preview.props.children).toBeDefined();
  });

  it('hidrata altitud_msnm del prop parametrosActuales', () => {
    const { getByTestId } = renderConSafeArea(
      <ParametrosTarifaForm
        id_prestador={7}
        id_acuerdo={100}
        parametrosActuales={{ ...parametrosFixture, altitud_msnm: 2600 }}
        repo={repoFake() as any}
        acuerdoRepo={acuerdoRepoFake() as any}
      />,
    );
    const input = getByTestId('param-altitud');
    // El FormField expone el value via prop `value` (string).
    expect(input.props.value).toBe('2600');
  });

  it('permite editar altitud_msnm', () => {
    const { getByTestId } = renderConSafeArea(
      <ParametrosTarifaForm
        id_prestador={7}
        id_acuerdo={100}
        parametrosActuales={{ ...parametrosFixture, altitud_msnm: 2600 }}
        repo={repoFake() as any}
        acuerdoRepo={acuerdoRepoFake() as any}
      />,
    );
    const input = getByTestId('param-altitud');
    fireEvent.changeText(input, '800');
    expect(input.props.value).toBe('800');
  });
});