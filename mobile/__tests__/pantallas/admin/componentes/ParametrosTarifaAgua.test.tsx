// mobile/__tests__/pantallas/admin/componentes/ParametrosTarifaAgua.test.tsx
//
// Tests contractuales del subcomponente `ParametrosTarifaAgua` —
// sección "Agua y suscriptores" del screen admin ParametrosTarifa
// (parametros-tarifa-screen-decomposition Phase 2 task 2.3).
//
// Cobertura (4 tests):
//   T-AGUA-1: renderiza los 3 inputs (param-agua, param-ipuf,
//             param-suscriptores) con sus valores controlados.
//   T-AGUA-2: propaga errores.suscriptores inline.
//   T-AGUA-3: helperTexts verbatim del screen original (estándar CRA
//             para IPUF, divisor de CF para suscriptores).
//   T-AGUA-4: disabled state cuando guardando=true o cargandoInputs=true.
//
// TDD Evidence:
//   RED  → componente no existe. Import tira Cannot find module.
//   GREEN → implementación en
//          `mobile/src/pantallas/admin/componentes/ParametrosTarifaAgua.tsx`.

import * as React from 'react';
import type { RefObject } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { View } from 'react-native';

import { ParametrosTarifaAgua } from '../../../../src/pantallas/admin/componentes/ParametrosTarifaAgua';
import type { FormValues } from '../../../../src/pantallas/admin/parametros-tarifa-build-borrador';
import type {
  FormSetters,
  UseParametrosFormStateReturn,
} from '../../../../src/pantallas/admin/hooks/useParametrosFormState';
import type { FormErrors } from '../../../../src/componentes/scroll-to-first-error';

function buildFormStateMock(opts: {
  readonly values?: Partial<FormValues>;
  readonly errors?: FormErrors;
  readonly cargandoInputs?: boolean;
  readonly setAguaSuministrada?: (v: string) => void;
  readonly setIpuf?: (v: string) => void;
  readonly setSuscriptoresPromedio?: (v: string) => void;
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
    setCma: jest.fn(),
    setCmo: jest.fn(),
    setCmi: jest.fn(),
    setCmt: jest.fn(),
    setCmviaa: jest.fn(),
    setAplicaCmviaa: jest.fn(),
    setCmaa: jest.fn(),
    setAplicaCmaa: jest.fn(),
    setActoAdopcion: jest.fn(),
    setEstudioCostosId: jest.fn(),
    setDocumentoSoporteUrl: jest.fn(),
    setAguaSuministrada: opts.setAguaSuministrada ?? jest.fn(),
    setIpuf: opts.setIpuf ?? jest.fn(),
    setSuscriptoresPromedio: opts.setSuscriptoresPromedio ?? jest.fn(),
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

function buildGetRef(): (key: 'suscriptores') => RefObject<View | null> {
  const refs: Record<string, RefObject<View | null>> = {};
  return (key) => {
    if (refs[key] === undefined) refs[key] = { current: null };
    return refs[key] as RefObject<View | null>;
  };
}

describe('ParametrosTarifaAgua — sección "Agua y suscriptores"', () => {
  // ─────────────────────────────────────────────────────────────────
  // T-AGUA-1: renderiza los 3 inputs.
  // ─────────────────────────────────────────────────────────────────
  describe('T-AGUA-1: renderiza los 3 inputs', () => {
    it('renderiza param-agua + param-ipuf + param-suscriptores', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-agua')).toBeTruthy();
      expect(getByTestId('param-ipuf')).toBeTruthy();
      expect(getByTestId('param-suscriptores')).toBeTruthy();
    });

    it('los inputs muestran el valor controlado desde formState.values', () => {
      const formState = buildFormStateMock({
        values: {
          aguaSuministrada: '50000',
          ipuf: '6',
          suscriptoresPromedio: '350',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-agua').props.value).toBe('50000');
      expect(getByTestId('param-ipuf').props.value).toBe('6');
      expect(getByTestId('param-suscriptores').props.value).toBe('350');
    });

    it('cambia valor → llama el setter correspondiente', () => {
      const setAguaSuministrada = jest.fn();
      const setIpuf = jest.fn();
      const setSuscriptoresPromedio = jest.fn();
      const formState = buildFormStateMock({
        setAguaSuministrada,
        setIpuf,
        setSuscriptoresPromedio,
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      fireEvent.changeText(getByTestId('param-agua'), '60000');
      fireEvent.changeText(getByTestId('param-ipuf'), '7');
      fireEvent.changeText(getByTestId('param-suscriptores'), '400');

      expect(setAguaSuministrada).toHaveBeenCalledWith('60000');
      expect(setIpuf).toHaveBeenCalledWith('7');
      expect(setSuscriptoresPromedio).toHaveBeenCalledWith('400');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-AGUA-2: propaga errores.suscriptores inline.
  // ─────────────────────────────────────────────────────────────────
  describe('T-AGUA-2: propaga errores inline', () => {
    it('muestra errores.suscriptores inline', () => {
      const formState = buildFormStateMock({
        errors: { suscriptores: 'Suscriptores debe ser > 0' },
      });
      const getRef = buildGetRef();

      const { getByTestId, getByText } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-suscriptores-error')).toBeTruthy();
      expect(getByText('Suscriptores debe ser > 0')).toBeTruthy();
      expect(getByTestId('param-suscriptores').props['aria-invalid']).toBe(true);
    });

    it('NO muestra error si suscriptores no es 0', () => {
      const formState = buildFormStateMock({
        values: { suscriptoresPromedio: '350' },
      });
      const getRef = buildGetRef();

      const { queryByTestId } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(queryByTestId('param-suscriptores-error')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-AGUA-3: helperTexts verbatim del screen original.
  // ─────────────────────────────────────────────────────────────────
  describe('T-AGUA-3: helperTexts preservados', () => {
    it('param-ipuf muestra el helperText "Estándar CRA: 6 m3/suscriptor/mes"', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByText } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByText('Estándar CRA: 6 m³/suscriptor/mes')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-AGUA-4: disabled state.
  // ─────────────────────────────────────────────────────────────────
  describe('T-AGUA-4: disabled state', () => {
    it('deshabilita los inputs cuando guardando=true', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={true}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-agua').props.editable).toBe(false);
      expect(getByTestId('param-ipuf').props.editable).toBe(false);
      expect(getByTestId('param-suscriptores').props.editable).toBe(false);
    });

    it('deshabilita los inputs cuando cargandoInputs=true', () => {
      const formState = buildFormStateMock({ cargandoInputs: true });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaAgua
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-agua').props.editable).toBe(false);
      expect(getByTestId('param-ipuf').props.editable).toBe(false);
      expect(getByTestId('param-suscriptores').props.editable).toBe(false);
    });
  });
});
