// mobile/__tests__/pantallas/admin/ParametrosTarifa.test.tsx
//
// Tests contractuales del ParametrosTarifaForm.
// Cobertura:
//   - T-PT-RENDER-1: renderiza el titulo y secciones del form con
//     parametrosActuales inyectado.
//   - PER-05: selectores específicos en useWorkspace(). Suscripción
//     limitada a id_prestador_activo. Cambios en otros campos del
//     store NO deben disparar re-renders.
//
// Mocks:
//   - AsyncStorage, theme tokens, expo-splash-screen.
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente.
//
// TDD Evidence:
//   RED  → primera cobertura directa de ParametrosTarifa.
//   GREEN → Tras el fix de selectores, los 4 tests pasan.

import { Profiler } from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

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
  },
  RADIUS: { sm: 4, md: 8, full: 999 },
  SHADOWS: { card: {} },
  SPACING: { xs: 4, sm: 8, md: 16 },
  TYPOGRAPHY: {
    labelMd: { fontSize: 14 },
    labelLg: { fontSize: 18 },
    headlineLg: { fontSize: 22 },
    headlineSm: { fontSize: 16 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
  },
}));

import { useWorkspace } from '../../../src/composicion/useWorkspace';
import ParametrosTarifaForm from '../../../src/pantallas/admin/ParametrosTarifa';
import type { ParametrosTarifa } from '../../../dominio/parametros-tarifa/types';

/** Parámetros tarifarios de fixture. */
const parametrosFixture: ParametrosTarifa = {
  id_parametros: 200,
  id_prestador: 7,
  id_acuerdo: 100,
  periodo: 2026,
  cma: 12_345_678,
  cmo: 450,
  cmi: 120,
  cmt: 80,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 50_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 350,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  vigente_desde: '2025-01-01',
  vigente_hasta: '2029-12-31',
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Repo de parámetros fake. */
function crearRepoFake() {
  return {
    guardar: jest.fn().mockResolvedValue(parametrosFixture),
    buscarVigente: jest.fn().mockResolvedValue(parametrosFixture),
  };
}

/** Repo de acuerdo fake con un id_acuerdo conocido. */
function crearAcuerdoRepoFake(id_acuerdo: number = 100) {
  return {
    buscarVigente: jest.fn().mockResolvedValue({ id_acuerdo }),
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

describe('ParametrosTarifaForm', () => {
  beforeEach(() => {
    useWorkspace.setState(ESTADO_INICIAL);
  });

  // ─────────────────────────────────────────────────────────────
  // Render smoke — titulo y secciones del formulario presentes.
  // ─────────────────────────────────────────────────────────────
  describe('render', () => {
    it('T-PT-RENDER-1 renderiza titulo y secciones con parametrosActuales inyectado', async () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake();
      const { getByText } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );

      await waitFor(() => {
        expect(getByText(/Parámetros Tarifarios · Prestador #7/)).toBeTruthy();
      });
      // Secciones del form.
      expect(getByText('Periodo y vigencia')).toBeTruthy();
      expect(getByText('Costos medios (estudio de costos del prestador)')).toBeTruthy();
      expect(getByText('Agua y suscriptores (insumo ASP = AS - IPUF×12×N)')).toBeTruthy();
      expect(getByText('Mínimo vital (Decreto 776/2025 — opcional)')).toBeTruthy();
      // Botón guardar presente.
      expect(getByText('Guardar Parámetros')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PER-05 — selector específico en useWorkspace()
  //
  // El componente usa SOLO `id_prestador_activo`. Cambios en otros campos
  // del store NO deben disparar re-renders.
  // ─────────────────────────────────────────────────────────────
  describe('PER-05 selectores específicos (no re-render en campos no usados)', () => {
    function contarUpdates(spy: jest.Mock): number {
      return spy.mock.calls.filter(([, phase]) => phase === 'update').length;
    }

    it('T-PER05-PT-1 NO se re-renderiza cuando cambia acuerdo_vigente (campo no usado)', () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake();
      useWorkspace.setState({ id_prestador_activo: 7 });
      const spy = jest.fn();

      render(
        <Profiler id="pt" onRender={spy}>
          <ParametrosTarifaForm
            id_acuerdo={100}
            parametrosActuales={parametrosFixture}
            repo={repo}
            acuerdoRepo={acuerdoRepo}
          />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      act(() => {
        useWorkspace.setState({
          acuerdo_vigente: { id_acuerdo: 999 } as never,
        });
      });

      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });

    it('T-PER05-PT-2 NO se re-renderiza cuando cambia prestadores_disponibles (campo no usado)', () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake();
      useWorkspace.setState({ id_prestador_activo: 7 });
      const spy = jest.fn();

      render(
        <Profiler id="pt" onRender={spy}>
          <ParametrosTarifaForm
            id_acuerdo={100}
            parametrosActuales={parametrosFixture}
            repo={repo}
            acuerdoRepo={acuerdoRepo}
          />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      act(() => {
        useWorkspace.setState({
          prestadores_disponibles: [{ id_prestador: 9, codigo: 'X', nombre: 'X' } as never],
        });
      });

      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });

    it('T-PER05-PT-3 NO se re-renderiza cuando cambia cargando (campo no usado)', () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake();
      useWorkspace.setState({ id_prestador_activo: 7 });
      const spy = jest.fn();

      render(
        <Profiler id="pt" onRender={spy}>
          <ParametrosTarifaForm
            id_acuerdo={100}
            parametrosActuales={parametrosFixture}
            repo={repo}
            acuerdoRepo={acuerdoRepo}
          />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      act(() => {
        useWorkspace.setState({ cargando: true });
      });

      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });
  });
});
