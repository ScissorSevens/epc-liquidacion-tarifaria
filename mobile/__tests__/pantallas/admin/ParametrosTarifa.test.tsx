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

jest.mock('../../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({
    repos: {
      parametrosTarifaRepo: {
        guardar: jest.fn().mockResolvedValue({}),
        buscarVigente: jest.fn().mockResolvedValue(null),
      },
      acuerdoMunicipalRepo: {
        buscarVigente: jest.fn().mockResolvedValue(null),
      },
    },
  }),
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
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24 },
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
    anio_base: 2016,
    factor_indexacion_ipc: 1.0,
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

  // ─────────────────────────────────────────────────────────────
  // T-SYNC: sincronización de state local con parametrosActuales
  // async (admin-screen-perf-fixes, Task 2).
  //
  // El componente recibe parametrosActuales=null en el primer mount
  // y el useEffect async eventualmente lo hidrata con valores de DB.
  // El state local debe sincronizarse UNA vez para que el form
  // muestre los valores cargados, pero NO debe sobrescribir una
  // edición posterior del usuario.
  // ─────────────────────────────────────────────────────────────
  describe('T-SYNC: sincronización async parametrosActuales → state local', () => {
    it('T-SYNC-1 inputs muestran valores de DB cuando parametrosActuales transiciona de null a populated', async () => {
      const repo = crearRepoFake();
      // Primer fetch devuelve null (caso "primera alta"). Luego
      // llegue parametrosActuales desde prop → el state local
      // debe sincronizar una sola vez.
      repo.buscarVigente.mockResolvedValueOnce(null);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId, rerender } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
      // Sin hidratacion, el form muestra defaults (cma=0, cmo=0).
      await waitFor(() => {
        expect(getByTestId('param-cma').props.value).toBe('0');
      });
      expect(getByTestId('param-cmo').props.value).toBe('0');

      // Re-render con parametrosActuales populated ⇒ el useEffect
      // de hidratación debe poblar los inputs con los valores de DB.
      rerender(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );

      await waitFor(() => {
        expect(getByTestId('param-cma').props.value).toBe('12345678');
      });
      expect(getByTestId('param-cmo').props.value).toBe('450');
      expect(getByTestId('param-periodo').props.value).toBe('2026');
      // Suscriptores: 350
      expect(getByTestId('param-suscriptores').props.value).toBe('350');
      // IPUF: 6 (default coincide con valor DB ⇒ string '6')
      expect(getByTestId('param-ipuf').props.value).toBe('6');
      // Agua: 50_000
      expect(getByTestId('param-agua').props.value).toBe('50000');
      // Vigente desde: 2025-01-01
      expect(getByTestId('param-vigente-desde').props.value).toBe('2025-01-01');
      // Vigente hasta: 2029-12-31
      expect(getByTestId('param-vigente-hasta').props.value).toBe('2029-12-31');
    });

    it('T-SYNC-2 edición local del usuario NO se sobrescribe cuando llega una actualización de parametrosActuales', async () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId, rerender } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );

      // Hidratación inicial: el form ya muestra los valores de DB.
      await waitFor(() => {
        expect(getByTestId('param-cma').props.value).toBe('12345678');
      });

      // User edita cma → 999.
      await act(async () => {
        fireEvent.changeText(getByTestId('param-cma'), '999');
      });
      expect(getByTestId('param-cma').props.value).toBe('999');

      // Re-render con parametrosActuales igual o nuevo (simula re-fetch).
      // La hidratación es one-shot: el state local editado debe prevalecer.
      rerender(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
      // El cma editado a 999 NO debe volver a 12345678.
      expect(getByTestId('param-cma').props.value).toBe('999');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // T-LOAD: loading guard durante bootstrap (admin-screen-perf-fixes,
  // Task 3). Todos los FormFields + Switches deben estar disabled
  // mientras repo === null O cargando === true. Mientras dure ese
  // período, un ActivityIndicator visible debe estar en el árbol.
  // ─────────────────────────────────────────────────────────────
  describe('T-LOAD: loading guard durante bootstrap', () => {
    it('T-LOAD-1 FormFields y Switches tienen disabled=true cuando repo === null', async () => {
      // Sin repo inyectado ⇒ el componente entra en estado de carga.
      // Todos los FormFields deben tener editable=false.
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId, getByLabelText, queryByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
          // repo omitido a proposito
          acuerdoRepo={acuerdoRepo}
        />,
      );
      // Periodo: editable debe ser false (repo === null).
      const inputPeriodo = getByTestId('param-periodo');
      expect(inputPeriodo.props.editable).toBe(false);
      // CMA tambien.
      const inputCma = getByTestId('param-cma');
      expect(inputCma.props.editable).toBe(false);
      // Verifico que al menos algun FormField adicional tambien esta disabled.
      const inputCmo = getByTestId('param-cmo');
      expect(inputCmo.props.editable).toBe(false);
      // Switches: el primero tiene accessibilityLabel "Aplicar costo medio
      // variable de inversion ambiental".
      const switchCmviaa = getByLabelText('Aplicar costo medio variable de inversión ambiental');
      expect(switchCmviaa.props.disabled).toBe(true);
      const switchMinimoVital = getByLabelText('Aplicar mínimo vital');
      expect(switchMinimoVital.props.disabled).toBe(true);
      // El ActivityIndicator debe estar visible.
      expect(queryByTestId('bootstrap-indicator')).toBeTruthy();
    });

    it('T-LOAD-2 ActivityIndicator visible mientras cargando === true', async () => {
      // Sin repo, sin parametrosActuales, sin acuerdoRepo.
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
        />,
      );
      // El ActivityIndicator con testID='bootstrap-indicator' debe estar
      // en el árbol (testID estable para tests).
      const indicator = getByTestId('bootstrap-indicator');
      expect(indicator).toBeTruthy();
    });

    it('T-LOAD-3 FormFields y Switches tienen disabled=false cuando bootstrap terminó (repo !== null && !cargando)', async () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId, getByLabelText, queryByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
      // Esperar a que el formulario llegue al estado estable.
      await waitFor(() => {
        expect(getByTestId('param-periodo').props.editable).toBe(true);
      });
      // Switches deben estar enabled.
      const switchCmviaa = getByLabelText('Aplicar costo medio variable de inversión ambiental');
      expect(switchCmviaa.props.disabled).toBe(false);
      const switchMinimoVital = getByLabelText('Aplicar mínimo vital');
      expect(switchMinimoVital.props.disabled).toBe(false);
      // El ActivityIndicator NO debe estar presente.
      expect(queryByTestId('bootstrap-indicator')).toBeNull();
    });
  });
});
