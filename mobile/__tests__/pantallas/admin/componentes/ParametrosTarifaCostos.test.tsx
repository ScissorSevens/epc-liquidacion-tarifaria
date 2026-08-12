// mobile/__tests__/pantallas/admin/componentes/ParametrosTarifaCostos.test.tsx
//
// Tests contractuales del subcomponente `ParametrosTarifaCostos` —
// sección "Costos medios" del screen admin ParametrosTarifa
// (parametros-tarifa-screen-decomposition Phase 2 task 2.2).
//
// Cobertura (6 tests):
//   T-COST-1: renderiza los 6 inputs numéricos (cma, cmo, cmi, cmt,
//             cmviaa, cmaa) con sus valores controlados.
//   T-COST-2: propaga errores.cma y errores.cmo inline.
//   T-COST-3: el Switch `switch-cmviaa` muestra/oculta el input
//             `param-cmviaa` según `formState.values.aplicaCmviaa`.
//   T-COST-4: el Switch `switch-cmaa` deshabilita el input `param-cmaa`
//             cuando `aplicaCmaa=false` (coherente con el screen).
//   T-COST-5: incluye el ResumenCargos inline con testID `resumen-cargos`
//             cuando `resumen` está provisto.
//   T-COST-6: disparara Haptics.selectionAsync al togglear switches
//             (Platform.OS !== 'web').
//
// TDD Evidence:
//   RED  → componente no existe. Import tira Cannot find module.
//   GREEN → implementación del componente en
//          `mobile/src/pantallas/admin/componentes/ParametrosTarifaCostos.tsx`.

import * as React from 'react';
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

// Mock expo-haptics inline (no wired via setupFiles). Patrón copiado
// de mobile/__tests__/pantallas/admin/ParametrosTarifa.test.tsx.
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
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

import * as Haptics from 'expo-haptics';

import { ParametrosTarifaCostos } from '../../../../src/pantallas/admin/componentes/ParametrosTarifaCostos';
import type { FormValues } from '../../../../src/pantallas/admin/parametros-tarifa-build-borrador';
import type { CargosResultantes } from '../../../../dominio/parametros-tarifa/calcular';
import type {
  FormSetters,
  UseParametrosFormStateReturn,
} from '../../../../src/pantallas/admin/hooks/useParametrosFormState';
import type { FormErrors } from '../../../../src/componentes/scroll-to-first-error';

const cargosResumenFixture: CargosResultantes = {
  cargo_fijo: 30_000,
  cargo_consumo: 700,
};

function buildFormStateMock(opts: {
  readonly values?: Partial<FormValues>;
  readonly errors?: FormErrors;
  readonly cargandoInputs?: boolean;
  readonly setCma?: (v: string) => void;
  readonly setCmo?: (v: string) => void;
  readonly setCmi?: (v: string) => void;
  readonly setCmt?: (v: string) => void;
  readonly setCmviaa?: (v: string) => void;
  readonly setCmaa?: (v: string) => void;
  readonly setAplicaCmviaa?: (v: boolean) => void;
  readonly setAplicaCmaa?: (v: boolean) => void;
}): UseParametrosFormStateReturn {
  const values: FormValues = {
    periodo: '2026',
    anioBase: '2016',
    anioDestino: '2026',
    factorIpc: '1',
    ipufIndice: '1',
    cma: '0',
    cmo: '0',
    cmi: '0',
    cmt: '0',
    cmviaa: '0',
    cmaa: '0',
    aplicaCmviaa: false,
    aplicaCmaa: false,
    actoAdopcion: '',
    estudioCostosId: '',
    documentoSoporteUrl: '',
    aguaSuministrada: '0',
    ipuf: '6',
    suscriptoresPromedio: '0',
    vigenteDesde: '2025-01-01',
    vigenteHasta: '2029-12-31',
    altitud: '0',
    ...opts.values,
  };
  const setters: FormSetters = {
    setPeriodo: jest.fn(),
    setAnioBase: jest.fn(),
    setAnioDestino: jest.fn(),
    setFactorIpc: jest.fn(),
    setIpufIndice: jest.fn(),
    setCma: opts.setCma ?? jest.fn(),
    setCmo: opts.setCmo ?? jest.fn(),
    setCmi: opts.setCmi ?? jest.fn(),
    setCmt: opts.setCmt ?? jest.fn(),
    setCmviaa: opts.setCmviaa ?? jest.fn(),
    setAplicaCmviaa: opts.setAplicaCmviaa ?? jest.fn(),
    setCmaa: opts.setCmaa ?? jest.fn(),
    setAplicaCmaa: opts.setAplicaCmaa ?? jest.fn(),
    setActoAdopcion: jest.fn(),
    setEstudioCostosId: jest.fn(),
    setDocumentoSoporteUrl: jest.fn(),
    setAguaSuministrada: jest.fn(),
    setIpuf: jest.fn(),
    setSuscriptoresPromedio: jest.fn(),
    setVigenteDesde: jest.fn(),
    setVigenteHasta: jest.fn(),
    setAltitud: jest.fn(),
  };
  return {
    values,
    setters,
    errores: opts.errors ?? {},
    setErrores: jest.fn(),
    cargando: false,
    cargandoInputs: opts.cargandoInputs ?? false,
    validarTodo: jest.fn().mockReturnValue({}),
    guardar: jest.fn().mockResolvedValue(undefined),
  };
}

function buildGetRef(): (key: 'cma' | 'cmo') => RefObject<View | null> {
  const refs: Record<string, RefObject<View | null>> = {};
  return (key) => {
    if (refs[key] === undefined) refs[key] = { current: null };
    return refs[key] as RefObject<View | null>;
  };
}

describe('ParametrosTarifaCostos — sección "Costos medios"', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // T-COST-1: renderiza los 6 inputs numericos.
  // ─────────────────────────────────────────────────────────────────
  describe('T-COST-1: renderiza los 6 inputs numéricos', () => {
    it('renderiza param-cma + param-cmo + param-cmi + param-cmt', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cma')).toBeTruthy();
      expect(getByTestId('param-cmo')).toBeTruthy();
      expect(getByTestId('param-cmi')).toBeTruthy();
      expect(getByTestId('param-cmt')).toBeTruthy();
    });

    it('cambia valor → llama el setter correspondiente', () => {
      const setCma = jest.fn();
      const setCmi = jest.fn();
      const setCmt = jest.fn();
      const formState = buildFormStateMock({ setCma, setCmi, setCmt });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      fireEvent.changeText(getByTestId('param-cma'), '12345678');
      fireEvent.changeText(getByTestId('param-cmi'), '120');
      fireEvent.changeText(getByTestId('param-cmt'), '80');

      expect(setCma).toHaveBeenCalledWith('12345678');
      expect(setCmi).toHaveBeenCalledWith('120');
      expect(setCmt).toHaveBeenCalledWith('80');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-COST-2: propaga errores.cma y errores.cmo inline.
  // ─────────────────────────────────────────────────────────────────
  describe('T-COST-2: propaga errores inline', () => {
    it('muestra errores.cma y errores.cmo', () => {
      const formState = buildFormStateMock({
        errors: {
          cma: 'CMA debe ser >= 2890 (Res CRA 825/2017 Art. 15)',
          cmo: 'CMO debe ser >= 467 (Res CRA 825/2017 Art. 18)',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId, getByText } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cma-error')).toBeTruthy();
      expect(getByTestId('param-cmo-error')).toBeTruthy();
      expect(getByText('CMA debe ser >= 2890 (Res CRA 825/2017 Art. 15)')).toBeTruthy();
      expect(getByText('CMO debe ser >= 467 (Res CRA 825/2017 Art. 18)')).toBeTruthy();
    });

    it('inputs sin error mantienen aria-invalid=false', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cma').props['aria-invalid']).toBe(false);
      expect(getByTestId('param-cmo').props['aria-invalid']).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-COST-3: Switch CMVIAA muestra/oculta el input param-cmviaa.
  // ─────────────────────────────────────────────────────────────────
  describe('T-COST-3: Switch CMVIAA', () => {
    it('NO renderiza param-cmviaa cuando aplicaCmviaa=false', () => {
      const formState = buildFormStateMock({
        values: { aplicaCmviaa: false, cmviaa: '50' },
      });
      const getRef = buildGetRef();

      const { queryByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(queryByTestId('param-cmviaa')).toBeNull();
    });

    it('renderiza param-cmviaa cuando aplicaCmviaa=true', () => {
      const formState = buildFormStateMock({
        values: { aplicaCmviaa: true, cmviaa: '50' },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cmviaa')).toBeTruthy();
      expect(getByTestId('param-cmviaa').props.value).toBe('50');
    });

    it('el Switch con testID switch-cmviaa dispara onValueChange + haptics', () => {
      const setAplicaCmviaa = jest.fn();
      const formState = buildFormStateMock({
        values: { aplicaCmviaa: false },
        setAplicaCmviaa,
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      fireEvent(getByTestId('switch-cmviaa'), 'valueChange', true);

      expect(setAplicaCmviaa).toHaveBeenCalledWith(true);
      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-COST-4: Switch CMAA deshabilita el input param-cmaa cuando
  // el flag esta apagado.
  // ─────────────────────────────────────────────────────────────────
  describe('T-COST-4: Switch CMAA', () => {
    it('param-cmaa editable=false cuando aplicaCmaa=false', () => {
      const formState = buildFormStateMock({
        values: { aplicaCmaa: false, cmaa: '1500' },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cmaa').props.editable).toBe(false);
    });

    it('param-cmaa editable=true cuando aplicaCmaa=true', () => {
      const formState = buildFormStateMock({
        values: { aplicaCmaa: true, cmaa: '1500' },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cmaa').props.editable).toBe(true);
      expect(getByTestId('param-cmaa').props.value).toBe('1500');
    });

    it('el Switch con testID switch-cmaa dispara onValueChange + haptics', () => {
      const setAplicaCmaa = jest.fn();
      const formState = buildFormStateMock({
        values: { aplicaCmaa: false },
        setAplicaCmaa,
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      fireEvent(getByTestId('switch-cmaa'), 'valueChange', true);

      expect(setAplicaCmaa).toHaveBeenCalledWith(true);
      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-COST-5: ResumenCargos inline con testID "resumen-cargos".
  // ─────────────────────────────────────────────────────────────────
  describe('T-COST-5: ResumenCargos inline', () => {
    it('renderiza el card resumen-cargos cuando resumen no es null', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={cargosResumenFixture}
        />,
      );

      expect(getByTestId('resumen-cargos')).toBeTruthy();
    });

    it('renderiza el card resumen-cargos incluso cuando resumen es null (placeholder)', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      // El ResumenCargos SIEMPRE se renderiza (con placeholder si cargos=null).
      expect(getByTestId('resumen-cargos')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-COST-6: disabled state coherente con el resto del form.
  // ─────────────────────────────────────────────────────────────────
  describe('T-COST-6: disabled state', () => {
    it('deshabilita los inputs cuando guardando=true', () => {
      const formState = buildFormStateMock({
        values: { aplicaCmaa: true, aplicaCmviaa: true },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={true}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cma').props.editable).toBe(false);
      expect(getByTestId('param-cmo').props.editable).toBe(false);
      expect(getByTestId('param-cmi').props.editable).toBe(false);
      expect(getByTestId('param-cmt').props.editable).toBe(false);
      expect(getByTestId('param-cmviaa').props.editable).toBe(false);
      expect(getByTestId('param-cmaa').props.editable).toBe(false);
    });

    it('deshabilita los inputs cuando cargandoInputs=true', () => {
      const formState = buildFormStateMock({
        values: { aplicaCmaa: true, aplicaCmviaa: true },
        cargandoInputs: true,
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaCostos
          formState={formState}
          guardando={false}
          getRef={getRef}
          resumen={null}
        />,
      );

      expect(getByTestId('param-cma').props.editable).toBe(false);
    });
  });
});
