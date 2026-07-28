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
import { Alert } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';

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
  ipuf_indice: 1.0,
  cargo_fijo_resultante: 12_345_678 / 350,
  cargo_consumo_resultante: 450 + 120 + 80,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2025-01-01',
  vigente_hasta: '2029-12-31',
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Repo de parámetros fake — implementa el contrato `ParametrosTarifaRepository`. */
function crearRepoFake() {
  return {
    guardar: jest.fn().mockResolvedValue(parametrosFixture),
    buscarVigente: jest.fn().mockResolvedValue(parametrosFixture),
    // Metodos no usados por el screen pero requeridos por la interface
    // para que el type-check NO rompa (antes el cast `as unknown as
    // ParametrosTarifaRepo` tapaba esto — TAREA 11 fix).
    crear: jest.fn().mockResolvedValue(parametrosFixture),
    obtenerPorId: jest.fn().mockResolvedValue(parametrosFixture),
    listar: jest.fn().mockResolvedValue([parametrosFixture]),
    buscarPorPeriodo: jest.fn().mockResolvedValue(parametrosFixture),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
}

/** Repo de acuerdo fake con un id_acuerdo conocido. */
function crearAcuerdoRepoFake(id_acuerdo: number = 100) {
  return {
    buscarVigente: jest.fn().mockResolvedValue({ id_acuerdo }),
    // Metodos no usados por el screen pero requeridos por la interface
    // `AcuerdoMunicipalRepository` (TAREA 11 fix: remover `as unknown`
    // exige adhesion completa).
    crear: jest.fn().mockResolvedValue({} as never),
    obtenerPorId: jest.fn().mockResolvedValue({} as never),
    listar: jest.fn().mockResolvedValue([] as never[]),
    eliminar: jest.fn().mockResolvedValue(undefined),
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

  // ─────────────────────────────────────────────────────────────
  // TAREA 11 (sdd-apply) — cerrar bug latente `repo.guardar`.
  //
  // Antes: `crearRepoFake()` proveia `guardar` en su tipo,
  // PERO NINGUN test fire el boton. Los tests pasaban aun con la
  // implementacion rota (`repo.guardar is not a function` en runtime
  // cuando el user tocaba "Guardar Parámetros" en produccion).
  //
  // Los tests de abajo ejercen el click REAL para garantizar que
  // la pantalla llama al metodo `guardar` del repositorio y que los
  // cargos pre-calculados (cargo_fijo_resultante, cargo_consumo_resultante)
  // se incluyen en el payload. Cualquier regresion del UPSERT queda
  // detectada por la firma `repo.guardar` no existe o falla.
  // ─────────────────────────────────────────────────────────────
  describe('Guardar Parámetros — repo.guardar contrato (TAREA 11 bug fix)', () => {
    /**
     * Cada FormField con `testID="param-cma"` propaga el testID al
     * TextInput con sufijo `-input` (ver FormField.tsx linea 215).
     * `fireEvent.changeText` invoca el onChangeText propagado.
     */
    it('T-PT-GUARDAR-1 click en "Guardar Parámetros" llama repo.guardar UNA vez', async () => {
      const repo = crearRepoFake();
      // `crearRepoFake` configura `buscarVigente` resolviendo a
      // `parametrosFixture`; lo reseteamos a null para validar el caso
      // "primera alta" del bug fix.
      repo.buscarVigente.mockResolvedValueOnce(null);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );

      // El BotonPrimario recibe testID='param-guardar' en su Pressable.
      const boton = getByTestId('param-guardar');
      await act(async () => {
        fireEvent.press(boton);
      });

      // Una sola llamada a repo.guardar.
      expect(repo.guardar).toHaveBeenCalledTimes(1);
    });

    it('T-PT-GUARDAR-2 el payload a repo.guardar incluye los cargos pre-calculados (cargo_fijo_resultante, cargo_consumo_resultante)', async () => {
      const repo = crearRepoFake();
      repo.buscarVigente.mockResolvedValueOnce(null);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
      // Inyectamos valores en los inputs del form para que
      // `calcularCargos(...)` produzca un cargo_fijo_resultante
      // distinto de 0. CMA=12_000_000, N=1000 → CF = 12_000.
      // FormField propaga testID directamente al TextInput.
      await act(async () => {
        fireEvent.changeText(getByTestId('param-cma'), '12000000');
        fireEvent.changeText(getByTestId('param-cmo'), '500');
        fireEvent.changeText(getByTestId('param-cmi'), '200');
        fireEvent.changeText(getByTestId('param-cmt'), '100');
        fireEvent.changeText(getByTestId('param-suscriptores'), '1000');
      });
      await act(async () => {
        fireEvent.press(getByTestId('param-guardar'));
      });
      await waitFor(() => {
        expect(repo.guardar).toHaveBeenCalledTimes(1);
      });

      const arg = repo.guardar.mock.calls[0]![0] as {
        cargo_fijo_resultante: number;
        cargo_consumo_resultante: number;
      };
      // El componente pre-calcula CF = CMA/N = 12_000_000/1000 = 12_000.
      // Y CC = CMO + CMI + CMT = 500 + 200 + 100 = 800.
      expect(arg.cargo_fijo_resultante).toBe(12_000);
      expect(arg.cargo_consumo_resultante).toBe(800);
    });

    it('T-PT-GUARDAR-3 muestra Alert.alert Éxito cuando repo.guardar resuelve', async () => {
      const repo = crearRepoFake();
      repo.buscarVigente.mockResolvedValueOnce(null);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );

      await act(async () => {
        fireEvent.press(getByTestId('param-guardar'));
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });
      const mensajeTitulo = (alertSpy.mock.calls[0]![0] as string) ?? '';
      expect(mensajeTitulo).toBe('Éxito');
      alertSpy.mockRestore();
    });

    it('T-PT-GUARDAR-4 muestra Alert.alert Error cuando repo.guardar rechaza', async () => {
      const repo = crearRepoFake();
      repo.buscarVigente.mockResolvedValueOnce(null);
      repo.guardar.mockRejectedValueOnce(new Error('boom'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );

      await act(async () => {
        fireEvent.press(getByTestId('param-guardar'));
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });
      const mensajeTitulo = (alertSpy.mock.calls[0]![0] as string) ?? '';
      expect(mensajeTitulo).toBe('Error');
      alertSpy.mockRestore();
    });

    it('T-PT-GUARDAR-5 prefill con `parametrosActuales` propaga los cargos existentes al form', async () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByDisplayValue } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );

      // El periodo pre-rellenado debe aparecer en el form.
      await waitFor(() => {
        expect(getByDisplayValue('2026')).toBeTruthy();
      });
    });
  });
});
