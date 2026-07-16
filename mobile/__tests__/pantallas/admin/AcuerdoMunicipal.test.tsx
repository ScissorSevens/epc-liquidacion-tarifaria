// mobile/__tests__/pantallas/admin/AcuerdoMunicipal.test.tsx
//
// Tests contractuales del AcuerdoMunicipalForm.
// Cobertura:
//   - T-AM-RENDER-1: renderiza la pantalla con los inputs cuando hay
//     acuerdoActual inyectado.
//   - PER-05: selectores específicos en useWorkspace(). Suscripción
//     limitada a id_prestador_activo (único campo del store que usa).
//     Cambios en otros campos NO deben re-renderizar.
//
// Mocks:
//   - AsyncStorage: zustand/persist escribe en cada set del store.
//   - theme tokens: defaults seguros.
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente.
//
// TDD Evidence:
//   RED  → estos tests son la primera cobertura de AcuerdoMunicipal.
//          Antes de este commit, el componente no tenía tests directos.
//   GREEN → Tras el fix de selectores, los 3 tests pasan.

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
    warning: '#f80',
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
import AcuerdoMunicipalForm from '../../../src/pantallas/admin/AcuerdoMunicipal';
import type { AcuerdoMunicipal } from '../../../dominio/acuerdo-municipal/types';

/** Acuerdo vigente de fixture. Solo necesitamos los campos que el form usa. */
const acuerdoFixture: AcuerdoMunicipal = {
  id_acuerdo: 100,
  id_prestador: 7,
  factor_subsidio_e1: -0.70,
  factor_subsidio_e2: -0.55,
  factor_subsidio_e3: -0.45,
  factor_contribucion_e5: 0.20,
  factor_contribucion_e6: 0.50,
  factor_contribucion_comercial: 0.50,
  factor_contribucion_industrial: 0.30,
  fecha_vigencia_desde: '2025-01-01',
  fecha_vigencia_hasta: '2029-12-31',
  acto_administrativo_url: null,
  observaciones: 'fixture',
  created_at: '2025-01-01T00:00:00.000Z',
};

/** Repo fake que devuelve el acuerdoFixture en buscarVigente. */
function crearRepoFake() {
  return {
    guardar: jest.fn().mockResolvedValue(acuerdoFixture),
    buscarVigente: jest.fn().mockResolvedValue(acuerdoFixture),
  };
}

/** Estado base del store. Coincide con `useWorkspace.test.ts` initial. */
const ESTADO_INICIAL = {
  id_prestador_activo: 0,
  prestador: null,
  prestadores_disponibles: [] as never[],
  acuerdo_vigente: null,
  parametros_vigentes: null,
  cargando: false,
};

describe('AcuerdoMunicipalForm', () => {
  beforeEach(() => {
    useWorkspace.setState(ESTADO_INICIAL);
  });

  // ─────────────────────────────────────────────────────────────
  // Render smoke — inputs y secciones del formulario presentes.
  // ─────────────────────────────────────────────────────────────
  describe('render', () => {
    it('T-AM-RENDER-1 renderiza titulo y secciones con acuerdoActual inyectado', async () => {
      const repo = crearRepoFake();
      const { getByText } = render(
        <AcuerdoMunicipalForm
          id_prestador={7}
          acuerdoActual={acuerdoFixture}
          repo={repo}
        />,
      );

      // El titulo del form menciona el id_prestador inyectado.
      await waitFor(() => {
        expect(getByText(/Acuerdo Municipal · Prestador #7/)).toBeTruthy();
      });
      // Secciones del form (subsidios, contribuciones, vigencia).
      expect(getByText('Subsidios por estrato (negativos)')).toBeTruthy();
      expect(getByText('Contribuciones por estrato (positivas)')).toBeTruthy();
      expect(getByText('Contribuciones por categoría de uso')).toBeTruthy();
      expect(getByText('Vigencia')).toBeTruthy();
      // Botón guardar presente.
      expect(getByText('Guardar Acuerdo')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PER-05 — selector específico en useWorkspace()
  //
  // El componente usa SOLO `id_prestador_activo`. Cambios en otros campos
  // del store NO deben disparar re-renders. Cuando id_prop es undefined,
  // el componente toma `id_prestador_activo` del store.
  // ─────────────────────────────────────────────────────────────
  describe('PER-05 selectores específicos (no re-render en campos no usados)', () => {
    function contarUpdates(spy: jest.Mock): number {
      return spy.mock.calls.filter(([, phase]) => phase === 'update').length;
    }

    it('T-PER05-AM-1 NO se re-renderiza cuando cambia acuerdo_vigente (campo no usado)', () => {
      const repo = crearRepoFake();
      useWorkspace.setState({ id_prestador_activo: 7 });
      const spy = jest.fn();

      render(
        <Profiler id="am" onRender={spy}>
          <AcuerdoMunicipalForm acuerdoActual={acuerdoFixture} repo={repo} />
        </Profiler>,
      );

      const baselineUpdates = contarUpdates(spy);

      // Cambiamos un campo que el AcuerdoMunicipalForm NO usa.
      act(() => {
        useWorkspace.setState({
          acuerdo_vigente: { id_acuerdo: 999, factor_subsidio_e1: -0.5 } as never,
        });
      });

      // PER-05: el cambio en acuerdo_vigente NO debe disparar un nuevo
      // render del form. Si lo dispara, es porque está suscrito al
      // store ENTERO.
      expect(contarUpdates(spy)).toBe(baselineUpdates);
    });

    it('T-PER05-AM-2 NO se re-renderiza cuando cambia parametros_vigentes (campo no usado)', () => {
      const repo = crearRepoFake();
      useWorkspace.setState({ id_prestador_activo: 7 });
      const spy = jest.fn();

      render(
        <Profiler id="am" onRender={spy}>
          <AcuerdoMunicipalForm acuerdoActual={acuerdoFixture} repo={repo} />
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

    it('T-PER05-AM-3 NO se re-renderiza cuando cambia prestadores_disponibles (campo no usado)', () => {
      const repo = crearRepoFake();
      useWorkspace.setState({ id_prestador_activo: 7 });
      const spy = jest.fn();

      render(
        <Profiler id="am" onRender={spy}>
          <AcuerdoMunicipalForm acuerdoActual={acuerdoFixture} repo={repo} />
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
  });
});
