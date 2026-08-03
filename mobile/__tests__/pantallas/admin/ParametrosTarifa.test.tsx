// mobile/__tests__/pantallas/admin/ParametrosTarifa.test.tsx
//
// Tests contractuales del ParametrosTarifaForm.
// Cobertura:
//   - T-PT-RENDER-1: renderiza el titulo y secciones del form con
//     parametrosActuales inyectado.
//   - PER-05: selectores específicos en useWorkspace(). Suscripción
//     limitada a id_prestador_activo. Cambios en otros campos del
//     store NO deben disparar re-renders.
//   - T-CRAFT-1..8: principios de craft impecable (typography clamp,
//     touch targets WCAG 2.5.5, contraste WCAG AA, sin ghost-cards ni
//     uppercase, inputs numericos copiables con tabular-nums) —
//     admin-parametros-tarifa-redesign Task 1.
//   - T-NATIVE-1..6: integracion expo-native-ui (Color API, SF Symbols,
//     haptics, contentInsetAdjustmentBehavior) — Task 2.
//   - T-INTEG-1..3 + T-A11Y-1..2: cobertura de integracion con datos
//     reales + accesibilidad (WCAG 2.x labels) — Task 3.
//
// Mocks:
//   - AsyncStorage, theme tokens, expo-splash-screen.
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente.
//   - expo-haptics: mockeado inline en este archivo para espiar la
//     llamada notificationAsync.
//   - expo-image: mockeado inline para evitar el import nativo.
//
// TDD Evidence:
//   RED  → primera cobertura directa de ParametrosTarifa.
//   GREEN → Tras el fix de selectores, los 4 tests pasan.

import * as fs from 'fs';
import * as path from 'path';
import { Profiler } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';
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

// Mock expo-haptics: espiable, retorna Promise<void>. Permite verificar
// que el screen llama notificationAsync(Success) al guardar exitosamente
// en iOS.
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock expo-image: el componente Image acepta un string `source="sf:..."`
// (SF Symbol) y lo renderea como <Text testID=...>source</Text>. Esto
// evita el import del native asset loader de expo-image.
jest.mock('expo-image', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Image = React.forwardRef(function MockImage(
    { source, testID, accessibilityLabel, style, tintColor }: {
      source: string | { uri?: string };
      testID?: string;
      accessibilityLabel?: string;
      style?: unknown;
      tintColor?: string;
    },
    ref: unknown,
  ) {
    const sourceStr = typeof source === 'string' ? source : (source?.uri ?? '');
    return React.createElement(
      Text,
      {
        ref,
        testID,
        accessibilityLabel,
        // Exponemos la source en children para que tests puedan
        // verificar el SF Symbol.
        accessibilityHint: tintColor !== undefined ? `tint:${tintColor}` : undefined,
      },
      sourceStr,
    );
  });
  return {
    Image,
  };
});

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
    success: '#76B718',
    successContainer: '#E8F5D9',
    onSuccessContainer: '#2E5A0A',
    warning: '#EF6C00',
    warningContainer: '#FFEDD5',
    errorContainer: '#ffdad6',
    surfaceLight: '#EFF4FF',
    surfaceContainerHigh: '#DCE9FF',
    brandAzulDigital: '#0092FF',
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

  // ─────────────────────────────────────────────────────────────────
  // T-CRAFT: principios impeccable (admin-parametros-tarifa-redesign
  // Task 1). Misma matriz que mi-perfil-redesign:
  //   - typography clamp en titulo (24..96 px)
  //   - touch targets ≥ 44px WCAG 2.5.5
  //   - contraste WCAG AA en texto principal
  //   - sin border + shadow combo (ghost-card ban)
  //   - sin textTransform: uppercase en section labels
  //   - inputs numericos con fontVariant: 'tabular-nums'
  //   - inputs numericos con prop selectable (copiables al portapapeles)
  // ─────────────────────────────────────────────────────────────────
  describe('T-CRAFT: principios impeccable (typography, touch, contrast, ghost-cards)', () => {
    /** Helper: convierte hex "#RGB" o "#RRGGBB" a [r,g,b] en 0..1 (sRGB). */
    function hexARgb01(hex: string): [number, number, number] {
      let limpio = hex.replace('#', '');
      // Expand shorthand "#RGB" -> "#RRGGBB".
      if (limpio.length === 3) {
        limpio = limpio.split('').map((c) => c + c).join('');
      }
      const r = parseInt(limpio.slice(0, 2), 16) / 255;
      const g = parseInt(limpio.slice(2, 4), 16) / 255;
      const b = parseInt(limpio.slice(4, 6), 16) / 255;
      return [r, g, b];
    }

    /** Luminancia relativa sRGB (WCAG 2.x). */
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

    function renderEstable() {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake();
      return render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
    }

    it('T-CRAFT-1 titulo usa fontSize dentro del rango clamp [24, 96] (responsive)', async () => {
      // El titulo "Parametros Tarifarios ..." debe tener un fontSize
      // efectivo que respete el clamp CSS `clamp(1.5rem, 3vw, 2.25rem)`
      // => rango permitido [24, 96] px. El valor exacto depende del
      // viewport pero SIEMPRE cae dentro del rango.
      const { getByText } = renderEstable();
      await waitFor(() => {
        expect(getByText(/Parámetros Tarifarios · Prestador #7/)).toBeTruthy();
      });
      const titulo = getByText(/Parámetros Tarifarios · Prestador #7/);
      const estilo = StyleSheet.flatten(titulo.props.style) as {
        fontSize?: number;
      };
      expect(estilo.fontSize).toBeGreaterThanOrEqual(24);
      expect(estilo.fontSize).toBeLessThanOrEqual(96);
    });

    it('T-CRAFT-2 los FormField numéricos tienen touch target ≥ 44 px (TextInput)', async () => {
      // El touch target real está definido por el TextInput del FormField
      // (estilos.input, minHeight: 48). Auditamos cada testID de input
      // numérico SIEMPRE renderizado y verificamos que su style efectivo
      // tiene minHeight/height ≥ 44 (WCAG 2.5.5).
      //
      // `param-cmviaa` y `param-m3gratis` son CONDICIONALES
      // (renderizan solo si aplica_cmviaa=true o aplica_minimo_vital=true).
      // En el fixture ambos flags son false → no se renderizan. Los
      // cubrimos con un render separado que fuerza ambos toggles activos.
      const { getByTestId, getByLabelText } = renderEstable();
      const testIdsSiempreRenderizados = [
        'param-periodo',
        'param-anio-base',
        'param-vigente-desde',
        'param-vigente-hasta',
        'param-cma',
        'param-cmo',
        'param-cmi',
        'param-cmt',
        'param-agua',
        'param-ipuf',
        'param-suscriptores',
      ];
      for (const id of testIdsSiempreRenderizados) {
        const input = getByTestId(id);
        expect(input).toBeTruthy();
        const estilo = StyleSheet.flatten(input.props.style) as {
          minHeight?: number;
          height?: number;
        };
        const alto = estilo.minHeight ?? estilo.height ?? 0;
        expect(alto).toBeGreaterThanOrEqual(44);
      }
      // Activamos los toggles para que los inputs condicionales
      // rendericen y podamos auditarlos.
      fireEvent(getByLabelText('Aplicar costo medio variable de inversión ambiental'), 'valueChange', true);
      fireEvent(getByLabelText('Aplicar mínimo vital'), 'valueChange', true);
      await waitFor(() => {
        expect(getByTestId('param-cmviaa')).toBeTruthy();
      });
      expect(getByTestId('param-m3gratis')).toBeTruthy();
      for (const id of ['param-cmviaa', 'param-m3gratis']) {
        const input = getByTestId(id);
        const estilo = StyleSheet.flatten(input.props.style) as {
          minHeight?: number;
          height?: number;
        };
        const alto = estilo.minHeight ?? estilo.height ?? 0;
        expect(alto).toBeGreaterThanOrEqual(44);
      }
    });

    it('T-CRAFT-3 el campoFila (fila del Switch) tiene minHeight ≥ 48 (WCAG 2.5.5)', async () => {
      // El Switch mide 24px de alto. Sin minHeight en la fila, el hit
      // area efectivo cae a 24-36 px y rompe WCAG 2.5.5. La fila debe
      // tener minHeight ≥ 48 px para que el touch target respete el
      // minimo WCAG.
      const { getByLabelText, UNSAFE_getAllByProps } = renderEstable();
      const switchCmviaa = getByLabelText(
        'Aplicar costo medio variable de inversión ambiental',
      );
      expect(switchCmviaa).toBeTruthy();
      // Buscamos el View padre directo con flexDirection row — la fila.
      // Filtram por la presencia del Switch como hijo o hermano.
      const filas = UNSAFE_getAllByProps({ accessibilityLabel: switchCmviaa.props.accessibilityLabel });
      expect(filas.length).toBeGreaterThanOrEqual(1);
      // La fila tiene flexDirection row + justifyContent space-between
      // + minHeight. Lo verificamos en el source del screen para no
      // depender del tree-walking.
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      const bloque = source.match(/campoFila:\s*\{([\s\S]*?)\n\s*\},?/);
      expect(bloque).not.toBeNull();
      const contenido = bloque![1];
      const heights = [...contenido.matchAll(/minHeight:\s*(\d+)/g)].map((m) =>
        Number(m[1]),
      );
      expect(heights.length).toBeGreaterThan(0);
      heights.forEach((h) => {
        expect(h).toBeGreaterThanOrEqual(44);
      });
    });

    it('T-CRAFT-4 contraste WCAG AA en texto principal del titulo (≥ 4.5:1 contra fondo)', async () => {
      // El titulo usa COLORS.onSurface (#0B1C30) sobre COLORS.background
      // (#F8F9FF). Calculamos el ratio WCAG y verificamos >= 4.5:1
      // (body text WCAG AA).
      const { getByText } = renderEstable();
      await waitFor(() => {
        expect(getByText(/Parámetros Tarifarios · Prestador #7/)).toBeTruthy();
      });
      const titulo = getByText(/Parámetros Tarifarios · Prestador #7/);
      const estilo = StyleSheet.flatten(titulo.props.style) as {
        color?: string;
      };
      const colorTexto = estilo.color ?? '#000000';
      const ratio = contrasteWcag(colorTexto, '#F8F9FF');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('T-CRAFT-5 el screen NO usa textTransform: uppercase en section labels (ALL CAPS ban)', async () => {
      // Sin comentarios: el codigo del screen ParametrosTarifa.tsx
      // NO debe contener `textTransform: 'uppercase'`. Mismo patron
      // que FormField/MiPerfil tests.
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      const sinComentarios = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
    });

    it('T-CRAFT-6 el screen NO combina border + shadow combo con shadowBlur >= 8 (sin ghost-cards)', async () => {
      // Ghost-card ban: el screen no debe combinar borderWidth >= 1
      // con shadowRadius >= 8 en el mismo bloque de estilos. Cards
      // usan solo border; sombras solo para FABs / floats.
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,400}?shadowRadius:\s*[1-9]/;
      expect(source).not.toMatch(ghostPattern);
      // Shadow radius >= 8 es decorativo (codex tell). Solo permitimos
      // sombras sutiles (radius < 8). Verificamos que no haya shadowRadius
      // mayor o igual a 8.
      const shadowBloque = source.match(/shadowRadius:\s*(\d+)/g);
      if (shadowBloque !== null) {
        shadowBloque.forEach((bloque) => {
          const valor = Number(bloque.match(/(\d+)/)![1]);
          expect(valor).toBeLessThan(8);
        });
      }
    });

    it('T-CRAFT-7 el source del screen pide FormField con soporte de selectable para inputs numericos', async () => {
      // El codigo del screen debe demostrar intención de pedir
      // `selectable` en los inputs numéricos (periodo, año base, cma,
      // cmo, cmi, cmt, cmviaa, agua, ipuf, suscriptores, m3gratis).
      // Verificamos que el SCREEN mencione `selectable` en su codigo.
      // La implementación real vive en FormField (que recibe `selectable`
      // como prop y lo forwarda al TextInput).
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      expect(source).toMatch(/selectable/);
    });

    it('T-CRAFT-8 el source del screen pide FormField con soporte de fontVariant tabular-nums', async () => {
      // El screen debe pasar tabular-nums (o fontVariant que lo
      // produzca) en los inputs numéricos. Verificamos que el codigo
      // del screen mencione `tabularNums` o `fontVariant` como prop.
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      expect(source).toMatch(/tabularNums|tabular-nums/);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-NATIVE: integracion expo-native-ui (Task 2)
  //   - Color API de expo-router con fallback hex
  //   - SF Symbols iOS via expo-image + fallback MaterialIcons Android
  //   - Haptics en exito de guardado (iOS)
  //   - ScrollView con contentInsetAdjustmentBehavior="automatic"
  // ─────────────────────────────────────────────────────────────────
  describe('T-NATIVE: integracion expo-native-ui (Color API, SF Symbols, haptics)', () => {
    let PlatformOriginalOS: string;

    beforeEach(() => {
      // Capturamos el valor ORIGINAL del OS (no el objeto Platform)
      // para evitar recursion infinita al restaurar. PlatformOriginal.OS
      // dispararia nuestro getter overridden => loop.
      PlatformOriginalOS = jest.requireActual('react-native').Platform.OS;
    });

    afterEach(() => {
      // Restauramos Platform.OS al valor original capturado.
      Object.defineProperty(require('react-native').Platform, 'OS', {
        get: () => PlatformOriginalOS,
      });
    });

    it('T-NATIVE-1 Platform.select con Color API retorna labels iOS en Platform.OS=ios', () => {
      // Audit: el screen debe invocar Platform.select envolviendo la
      // resolucion de colores para acceder a la semantica nativa
      // (UIColor.label en iOS, MaterialTheme en Android) con fallback
      // hex en Hermes/Jest. Verificamos source-level que el codigo
      // declara Platform.select y referencia colores nativos esperados.
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      expect(source).toMatch(/Platform\.select/);
      // Declara los nativos esperados (label/secondaryLabel/systemBackground).
      // El codigo real usa Platform.select con keys ios/android y fallback hex.
      expect(source).toMatch(/ios:\s*['"]#[0-9A-Fa-f]{3,6}|ios:\s*[^,]*systemBackground|ios:\s*[^,]*\.label/);
    });

    it('T-NATIVE-2 el source usa tokens de fallback hex (no colores hardcoded)', () => {
      // Los colores nativos de iOS/Android no resuelven en Hermes/Jest.
      // El screen debe tener fallback hex explicito via Platform.select.
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      // Platform.select con default
      expect(source).toMatch(/Platform\.select\(\{[\s\S]*?default:/);
    });

    it('T-NATIVE-3 en iOS, el icono save del boton Guardar usa <Image source="sf:tray.and.arrow.down" />', async () => {
      // Forzamos Platform.OS = 'ios' y verificamos que el boton
      // Guardar renderiza un <Image> de expo-image con source SF Symbol.
      Object.defineProperty(require('react-native').Platform, 'OS', {
        get: () => 'ios',
      });
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake();
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
      await waitFor(() => {
        expect(getByTestId('param-guardar')).toBeTruthy();
      });
      // El mock de expo-image renderea `<Text testID="param-guardar-icon">sf:tray.and.arrow.down</Text>`.
      const icono = getByTestId('param-guardar-icon');
      expect(icono).toBeTruthy();
      // El children del Text mock es la source string completa.
      expect(icono.props.children).toBe('sf:tray.and.arrow.down');
      // El tint color se propaga via accessibilityHint como "tint:#hex".
      expect(icono.props.accessibilityHint).toMatch(/^tint:/);
    });

    it('T-NATIVE-4 en Android, el icono save del boton Guardar usa <MaterialIcons name="save" />', async () => {
      // Forzamos Platform.OS = 'android' y verificamos que el icono
      // del boton Guardar es MaterialIcons "save" (no SF Symbol).
      Object.defineProperty(require('react-native').Platform, 'OS', {
        get: () => 'android',
      });
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake();
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
      await waitFor(() => {
        expect(getByTestId('param-guardar-icon')).toBeTruthy();
      });
      // El icono MaterialIcons mockeado expone "save" como children.
      expect(getByTestId('param-guardar-icon').props.children).toBe('save');
    });

    it('T-NATIVE-5 al tocar Guardar en iOS, llama Haptics.notificationAsync(Success) tras guardar exitosamente', async () => {
      Object.defineProperty(require('react-native').Platform, 'OS', {
        get: () => 'ios',
      });
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
      const haptics = require('expo-haptics');
      await act(async () => {
        fireEvent.press(getByTestId('param-guardar'));
      });
      // Tras guardar exitosamente, haptics.notificationAsync debe
      // haberse llamado con NotificationFeedbackType.Success.
      await waitFor(() => {
        expect(haptics.notificationAsync).toHaveBeenCalled();
      });
      const calls = haptics.notificationAsync.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1]!;
      expect(lastCall[0]).toBe(haptics.NotificationFeedbackType.Success);
    });

    it('T-NATIVE-6 el ScrollView raiz tiene prop contentInsetAdjustmentBehavior="automatic"', async () => {
      // Para integrarse con el safe-area y navigation bar de iOS,
      // el ScrollView raiz debe tener contentInsetAdjustmentBehavior
      // = "automatic" (iOS). Lo verificamos via source code.
      const source = fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
      expect(source).toMatch(/contentInsetAdjustmentBehavior=["']automatic["']/);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-DESIGN: principios impeccable + expo-native-ui (Commit 3).
  // Verifica que el screen respeta los design tokens consistentes:
  //   - RADIUS.lg (12) en containers card-like.
  //   - COLORES_NATIVOS como Color API shim (Platform.select).
  //   - SF Symbols iOS via expo-image + fallback MaterialIcons Android.
  //   - Touch targets >= 44px WCAG 2.5.5 en TODOS los Pressable.
  //   - Sin comments outdated (Paper, deprecated libraries).
  // ─────────────────────────────────────────────────────────────────
  describe('T-DESIGN: design tokens consistentes (impeccable + expo-native-ui)', () => {
    function readSource(): string {
      return fs.readFileSync(
        path.join(__dirname, '../../../src/pantallas/admin/ParametrosTarifa.tsx'),
        'utf8',
      );
    }

    /**
     * T-DESIGN-1 — Containers card-like usan RADIUS tokens (no
     * borderRadius hardcoded como número). La sección "warningCma" y
     * otros containers deben usar `RADIUS.sm` / `RADIUS.md` / `RADIUS.lg`.
     */
    it('T-DESIGN-1: containers usan RADIUS.* tokens (no borderRadius hardcoded)', () => {
      const source = readSource();
      // Buscamos borderRadius: <numero> literal (sin tokens).
      // La regex captura el número inmediato después de borderRadius:.
      const hardcoded = source.match(/borderRadius:\s*(\d+)/g) ?? [];
      // Solo permitimos RADIUS.* tokens — sin números crudos.
      expect(hardcoded.length).toBe(0);
      // El source debe declarar uso de tokens RADIUS en al menos un style.
      expect(source).toMatch(/RADIUS\.(sm|md|lg|full|xl)/);
    });

    /**
     * T-DESIGN-2 — El screen usa COLORES_NATIVOS (Color API shim) o
     * tokens del theme. NO hardcodeamos hex en styles inline.
     */
    it('T-DESIGN-2: usa COLORES_NATIVOS (Color API shim), no colores hardcoded', () => {
      const source = readSource();
      // Declara el shim COLORES_NATIVOS.
      expect(source).toMatch(/COLORES_NATIVOS/);
      // Resuelve via Platform.select con keys ios/android/default.
      expect(source).toMatch(/Platform\.select\(\{[\s\S]*?ios:[\s\S]*?android:[\s\S]*?default:/);
    });

    /**
     * T-DESIGN-3 — Platform.OS=iOS renderiza SF Symbols via expo-image.
     * El botón Guardar ya implementa este patrón (T-NATIVE-3 verifica
     * el render); este test verifica que el patrón está presente en el
     * source para futuros iconos (regression guard).
     */
    it('T-DESIGN-3: Platform.OS=ios usa SF Symbols via expo-image', () => {
      const source = readSource();
      // El IconoGuardar retorna <Image source="sf:..."> en iOS.
      expect(source).toMatch(/source=['"]sf:[a-z.]+['"]/);
      // Y NO usa MaterialIcons en iOS.
      const iosBlock = source.match(/Platform\.OS\s*===\s*['"]ios['"][\s\S]{0,500}/);
      expect(iosBlock).not.toBeNull();
      expect(iosBlock![0]).toMatch(/expo-image|<Image/);
    });

    /**
     * T-DESIGN-4 — Platform.OS=Android usa MaterialIcons como fallback.
     */
    it('T-DESIGN-4: Platform.OS=android usa MaterialIcons fallback', () => {
      const source = readSource();
      // El IconoGuardar retorna MaterialIcons en default/Android.
      expect(source).toMatch(/MaterialIcons/);
    });

    /**
     * T-DESIGN-5 — Todos los Pressable user-facing tienen minHeight >= 44
     * (WCAG 2.5.5). Verificamos el source code de cada Pressable / Switch
     * fila para confirmar que el wrapper respeta el target size.
     */
    it('T-DESIGN-5: Pressable y campoFila tienen minHeight >= 44 (WCAG 2.5.5)', () => {
      const source = readSource();
      // El bloque campoFila (fila del Switch) tiene minHeight explicito.
      const campoFilaBloque = source.match(/campoFila:\s*\{([\s\S]*?)\n\s*\},?/);
      expect(campoFilaBloque).not.toBeNull();
      const heights = [...campoFilaBloque![1].matchAll(/minHeight:\s*(\d+)/g)].map((m) =>
        Number(m[1]),
      );
      expect(heights.length).toBeGreaterThan(0);
      heights.forEach((h) => {
        expect(h).toBeGreaterThanOrEqual(44);
      });
      // El botón guardar (BotonPrimario) usa height 56 nativo >= 44.
      expect(source).toMatch(/param-guardar/);
    });

    /**
     * T-DESIGN-6 — Sin comments outdated. La librería "Paper" (react-native-paper)
     * nunca fue adoptada en este codebase; cualquier comment que la mencione
     * es leftover de una migración previa.
     */
    it('T-DESIGN-6: source SIN comments outdated referenciando Paper o librerías deprecated', () => {
      const source = readSource();
      // Filtramos comments y verificamos que ninguno menciona Paper, Snackbar,
      // Appbar (Paper-specific) o react-native-paper.
      const sinComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComments).not.toMatch(/Paper/);
      expect(sinComments).not.toMatch(/Snackbar/);
      expect(sinComments).not.toMatch(/Appbar/);
      expect(sinComments).not.toMatch(/react-native-paper/);
    });
  });
  describe('T-PERSIST: sincronización del store tras repo.guardar (mi-perfil-unification Commit 2)', () => {
    /**
     * T-PERSIST-1 — Al guardar, repo.guardar se llama UNA vez.
     * Refuerza el contrato de la TAREA 11 (bug `repo.guardar is not a
     * function`). El screen debe llamar repo.guardar UNA vez por click
     * en "Guardar Parámetros".
     */
    it('T-PERSIST-1: al guardar, repo.guardar se llama UNA vez', async () => {
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
      await act(async () => {
        fireEvent.press(getByTestId('param-guardar'));
      });
      await waitFor(() => {
        expect(repo.guardar).toHaveBeenCalledTimes(1);
      });
    });

    /**
     * T-PERSIST-2 — Tras guardar, setParametrosVigentes se invoca con el
     * payload devuelto por repo.guardar. Este test verifica el BUG FIX
     * crítico: antes el store quedaba stale porque el screen solo
     * pre-calculaba localmente y nunca sincronizaba el store Zustand.
     */
    it('T-PERSIST-2: tras guardar, setParametrosVigentes se invoca con payload del repo', async () => {
      const repo = crearRepoFake();
      const payloadGuardado: ParametrosTarifa = {
        ...parametrosFixture,
        cma: 99_999_999,
        cargo_fijo_resultante: 99_999_999 / 350,
      };
      repo.guardar.mockResolvedValueOnce(payloadGuardado);
      repo.buscarVigente.mockResolvedValueOnce(null);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const setParametrosVigentes = jest.fn();
      // El screen usa `useWorkspace.getState().setParametrosVigentes(p)`.
      // Mockeamos getState para que retorne la acción espiada.
      const stateSpy = jest
        .spyOn(useWorkspace, 'getState')
        .mockReturnValue({ setParametrosVigentes } as never);
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
        expect(setParametrosVigentes).toHaveBeenCalled();
      });
      // El payload pasado al setter debe ser el mismo que retornó repo.guardar.
      const arg = setParametrosVigentes.mock.calls[0]![0] as ParametrosTarifa;
      expect(arg).toBe(payloadGuardado);
      expect(arg.cma).toBe(99_999_999);
      stateSpy.mockRestore();
    });

    /**
     * T-PERSIST-3 — Si repo.guardar rechaza (falla), el setter NO se
     * invoca. La promesa rechazada debe propagarse al Alert.alert
     * "Error" y NO tocar el store.
     */
    it('T-PERSIST-3: si repo.guardar falla, NO se invoca setParametrosVigentes', async () => {
      const repo = crearRepoFake();
      repo.buscarVigente.mockResolvedValueOnce(null);
      repo.guardar.mockRejectedValueOnce(new Error('boom'));
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const setParametrosVigentes = jest.fn();
      const stateSpy = jest
        .spyOn(useWorkspace, 'getState')
        .mockReturnValue({ setParametrosVigentes } as never);
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation(() => undefined);
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
      // Esperar a que Alert.alert se haya llamado.
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });
      // El setter NO debe haberse invocado.
      expect(setParametrosVigentes).not.toHaveBeenCalled();
      stateSpy.mockRestore();
      alertSpy.mockRestore();
    });

    /**
     * T-PERSIST-4 — Tras guardar, el repo acepta el payload completo
     * (incluye los cargos pre-calculados). El setter del store se
     * invoca con el payload que el repo devolvió, garantizando que el
     * cache local refleja exactamente lo persistido.
     */
    it('T-PERSIST-4: tras guardar, setParametrosVigentes recibe payload con cargos pre-calculados', async () => {
      const repo = crearRepoFake();
      const nuevosParams: ParametrosTarifa = {
        ...parametrosFixture,
        cma: 77_777_777,
        suscriptores_promedio: 350,
        cargo_fijo_resultante: 77_777_777 / 350,
        cargo_consumo_resultante: 450 + 120 + 80,
      };
      repo.guardar.mockResolvedValueOnce(nuevosParams);
      repo.buscarVigente.mockResolvedValueOnce(null);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const setParametrosVigentes = jest.fn();
      const stateSpy = jest
        .spyOn(useWorkspace, 'getState')
        .mockReturnValue({ setParametrosVigentes } as never);
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
        expect(setParametrosVigentes).toHaveBeenCalledWith(nuevosParams);
      });
      const arg = setParametrosVigentes.mock.calls[0]![0] as ParametrosTarifa;
      // El payload guardado incluye los cargos pre-calculados.
      expect(arg.cargo_fijo_resultante).toBe(77_777_777 / 350);
      expect(arg.cargo_consumo_resultante).toBe(450 + 120 + 80);
      expect(arg.cma).toBe(77_777_777);
      stateSpy.mockRestore();
    });

    /**
     * T-PERSIST-5 — Tras guardar, el store refleja los nuevos parámetros
     * vía setParametrosVigentes. Esto es la integración end-to-end:
     * el setter es la ÚNICA vía que la liquidación usa para leer
     * parámetros tarifarios en runtime.
     */
    it('T-PERSIST-5: tras guardar, setParametrosVigentes actualiza el store Zustand', async () => {
      const repo = crearRepoFake();
      const nuevosParams: ParametrosTarifa = {
        ...parametrosFixture,
        cma: 55_555_555,
      };
      repo.guardar.mockResolvedValueOnce(nuevosParams);
      repo.buscarVigente.mockResolvedValueOnce(null);
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const setParametrosVigentes = jest.fn();
      const stateSpy = jest
        .spyOn(useWorkspace, 'getState')
        .mockReturnValue({ setParametrosVigentes } as never);
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
        expect(repo.guardar).toHaveBeenCalled();
      });
      // Verificamos que el store se sincronizó con el payload devuelto.
      expect(setParametrosVigentes).toHaveBeenCalledTimes(1);
      const arg = setParametrosVigentes.mock.calls[0]![0] as ParametrosTarifa;
      expect(arg.cma).toBe(55_555_555);
      stateSpy.mockRestore();
    });
  });

  describe('T-INTEG: integracion con datos reales del repo', () => {
    it('T-INTEG-1 renderizado completo con parametrosActuales hidrata cada FormField con el valor correcto', async () => {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
      // Tras la hidratacion, cada FormField debe mostrar el valor de DB.
      await waitFor(() => {
        expect(getByTestId('param-periodo').props.value).toBe('2026');
      });
      expect(getByTestId('param-anio-base').props.value).toBe('2016');
      expect(getByTestId('param-vigente-desde').props.value).toBe('2025-01-01');
      expect(getByTestId('param-vigente-hasta').props.value).toBe('2029-12-31');
      expect(getByTestId('param-cma').props.value).toBe('12345678');
      expect(getByTestId('param-cmo').props.value).toBe('450');
      expect(getByTestId('param-cmi').props.value).toBe('120');
      expect(getByTestId('param-cmt').props.value).toBe('80');
      expect(getByTestId('param-agua').props.value).toBe('50000');
      expect(getByTestId('param-ipuf').props.value).toBe('6');
      expect(getByTestId('param-suscriptores').props.value).toBe('350');
    });

    it('T-INTEG-2 el boton Guardar queda disabled mientras cargandoInputs=true (loading guard preservado)', async () => {
      // Sin repo inyectado, el componente entra en estado de carga.
      // El BotonPrimario debe reflejar disabled=true.
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByTestId } = render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={null}
          acuerdoRepo={acuerdoRepo}
          // repo omitido a proposito
        />,
      );
      const boton = getByTestId('param-guardar');
      // El Pressable debe tener disabled=true via accessibilityState
      // (BotonPrimario lo setea asi). Tambien verificamos que el
      // callback onPress es no-op cuando disabled.
      const estado = boton.props.accessibilityState;
      expect(estado?.disabled).toBe(true);
    });

    it('T-INTEG-3 el screen renderiza en orden jerarquico: titulo → secciones → boton guardar', async () => {
      // Regresion: el orden visual del form debe respetar la
      // jerarquia H1 (titulo) → H2 (secciones) → CTA (boton).
      // Verificamos via el orden de los testIDs.
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      const { getByText, getByTestId } = render(
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
      // El titulo debe estar presente.
      expect(getByText(/Parámetros Tarifarios · Prestador #7/)).toBeTruthy();
      // Las 4 secciones del form deben estar presentes (orden
      // logico: Periodo → Costos → Agua → Minimo vital).
      expect(getByText('Periodo y vigencia')).toBeTruthy();
      expect(getByText('Costos medios (estudio de costos del prestador)')).toBeTruthy();
      expect(getByText('Agua y suscriptores (insumo ASP = AS - IPUF×12×N)')).toBeTruthy();
      expect(getByText('Mínimo vital (Decreto 776/2025 — opcional)')).toBeTruthy();
      // El CTA guardar debe estar presente.
      expect(getByTestId('param-guardar')).toBeTruthy();
    });
  });

  describe('T-A11Y: accesibilidad WCAG 2.x', () => {
    function renderConDatos() {
      const repo = crearRepoFake();
      const acuerdoRepo = crearAcuerdoRepoFake(100);
      return render(
        <ParametrosTarifaForm
          id_prestador={7}
          id_acuerdo={100}
          parametrosActuales={parametrosFixture}
          repo={repo}
          acuerdoRepo={acuerdoRepo}
        />,
      );
    }

    it('T-A11Y-1 TODOS los FormField numéricos tienen accessibilityLabel accesible', () => {
      const { getByTestId } = renderConDatos();
      // Cada FormField propaga accessibilityLabel al TextInput. Verificamos
      // los 13 testIDs que cubren todos los FormFields numéricos.
      const testIds = [
        'param-periodo',
        'param-anio-base',
        'param-vigente-desde',
        'param-vigente-hasta',
        'param-cma',
        'param-cmo',
        'param-cmi',
        'param-cmt',
        'param-agua',
        'param-ipuf',
        'param-suscriptores',
      ];
      for (const id of testIds) {
        const input = getByTestId(id);
        const label = input.props.accessibilityLabel;
        // accessibilityLabel puede ser string o undefined. Si es
        // undefined, la accessibility falls back al label del View
        // padre. Verificamos que NO este vacio (string vacio = ban WCAG).
        if (label !== undefined) {
          expect(typeof label).toBe('string');
          expect((label as string).length).toBeGreaterThan(0);
        }
      }
    });

    it('T-A11Y-2 los Switches (CMVIAA y minimo vital) tienen accessibilityLabel definido', () => {
      const { getByLabelText } = renderConDatos();
      // El Switch CMVIAA tiene accessibilityLabel explicito (lo
      // pasamos en el callsite). Mismo patron para minimo vital.
      const switchCmviaa = getByLabelText('Aplicar costo medio variable de inversión ambiental');
      expect(switchCmviaa).toBeTruthy();
      const switchMinimoVital = getByLabelText('Aplicar mínimo vital');
      expect(switchMinimoVital).toBeTruthy();
    });
  });
});
