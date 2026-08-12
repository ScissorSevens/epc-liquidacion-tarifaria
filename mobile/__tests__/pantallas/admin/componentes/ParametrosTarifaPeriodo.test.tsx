// mobile/__tests__/pantallas/admin/componentes/ParametrosTarifaPeriodo.test.tsx
//
// Tests contractuales del subcomponente `ParametrosTarifaPeriodo` —
// sección "Periodo y vigencia" del screen admin ParametrosTarifa
// (parametros-tarifa-screen-decomposition Phase 2 task 2.1).
//
// Cobertura (4 tests):
//   T-PER-1: renderiza los 3 inputs visibles (param-periodo,
//            param-vigente-desde, param-vigente-hasta) con sus valores
//            y setters vinculados al formState. El input `anio-base`
//            fue eliminado de esta sección por el cleanup C-1/A-2 de
//            `param-tarifa-residuales-cra-825` (queda duplicado en
//            IPC como `param-anio-base-ipc`).
//   T-PER-2: propaga el error `formState.errores.vigenteHasta` al
//            FormField correspondiente y lo limpia cuando setErrores
//            emite un FormErrors vacío.
//   T-PER-3: deshabilita los inputs cuando `guardando=true` o
//            `cargandoInputs=true`.
//   T-PER-4: las accessibilityHint verbatim del screen original
//            (fechas de vigencia) se preservan.
//
// TDD Evidence:
//   RED  → componente no existe. Import tira Cannot find module.
//   GREEN → implementación del componente en
//          `mobile/src/pantallas/admin/componentes/ParametrosTarifaPeriodo.tsx`.
//          Los 4 tests pasan.

import * as React from 'react';
import type { RefObject } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { View } from 'react-native';

import { ParametrosTarifaPeriodo } from '../../../../src/pantallas/admin/componentes/ParametrosTarifaPeriodo';
import type { FormValues } from '../../../../src/pantallas/admin/parametros-tarifa-build-borrador';
import type {
  FormSetters,
  UseParametrosFormStateReturn,
} from '../../../../src/pantallas/admin/hooks/useParametrosFormState';
import type { FormErrors } from '../../../../src/componentes/scroll-to-first-error';

/**
 * Builder de un `formState` mock para tests unitarios del subcomponente.
 * El subcomponente consume `formState.values`, `formState.setters`,
 * `formState.errores` y `formState.cargandoInputs` — el resto de los
 * campos del hook (`validarTodo`, `guardar`, etc.) no se usa en estos
 * componentes presentational puros.
 */
function buildFormStateMock(opts: {
  readonly values?: Partial<FormValues>;
  readonly errors?: FormErrors;
  readonly cargandoInputs?: boolean;
  readonly setPeriodo?: (v: string) => void;
  readonly setAnioBase?: (v: string) => void;
  readonly setVigenteDesde?: (v: string) => void;
  readonly setVigenteHasta?: (v: string) => void;
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
    setPeriodo: opts.setPeriodo ?? jest.fn(),
    setAnioBase: opts.setAnioBase ?? jest.fn(),
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
    setAguaSuministrada: jest.fn(),
    setIpuf: jest.fn(),
    setSuscriptoresPromedio: jest.fn(),
    setVigenteDesde: opts.setVigenteDesde ?? jest.fn(),
    setVigenteHasta: opts.setVigenteHasta ?? jest.fn(),
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

/**
 * `getRef` mockeada para los tests. Cada llamada retorna una ref
 * distinta (criterio de `useFormFieldRefs` original — un solo Map
 * mutable). En este test no validamos el scroll behavior, solo
 * que las refs se pasan correctamente.
 */
function buildGetRef() {
  const refs: Record<string, RefObject<View | null>> = {};
  const getRef = (key: string): RefObject<View | null> => {
    if (refs[key] === undefined) refs[key] = { current: null };
    return refs[key] as RefObject<View | null>;
  };
  return getRef;
}

describe('ParametrosTarifaPeriodo — sección "Periodo y vigencia"', () => {
  // ─────────────────────────────────────────────────────────────────
  // T-PER-1: renderiza los 3 inputs con sus testIDs y valores
  // vinculados al formState. Limpio C-1/A-2: `param-anio-base` ya NO
  // existe en esta sección (queda en IPC como `param-anio-base-ipc`).
  // ─────────────────────────────────────────────────────────────────
  describe('T-PER-1: renderiza los 3 inputs', () => {
    it('renderiza param-periodo + param-vigente-desde + param-vigente-hasta', () => {
      const formState = buildFormStateMock({
        values: {
          periodo: '2026',
          vigenteDesde: '2025-01-01',
          vigenteHasta: '2029-12-31',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-periodo')).toBeTruthy();
      expect(getByTestId('param-vigente-desde')).toBeTruthy();
      expect(getByTestId('param-vigente-hasta')).toBeTruthy();
    });

    it('los inputs muestran el valor controlado desde formState.values', () => {
      const formState = buildFormStateMock({
        values: {
          periodo: '2027',
          vigenteDesde: '2026-01-01',
          vigenteHasta: '2030-12-31',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-periodo').props.value).toBe('2027');
      expect(getByTestId('param-vigente-desde').props.value).toBe('2026-01-01');
      expect(getByTestId('param-vigente-hasta').props.value).toBe('2030-12-31');
    });

    it('cambia valor → llama el setter correspondiente del formState', () => {
      const setPeriodo = jest.fn();
      const setVigenteHasta = jest.fn();
      const formState = buildFormStateMock({ setPeriodo, setVigenteHasta });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      fireEvent.changeText(getByTestId('param-periodo'), '2028');
      fireEvent.changeText(getByTestId('param-vigente-hasta'), '2032-12-31');

      expect(setPeriodo).toHaveBeenCalledWith('2028');
      expect(setVigenteHasta).toHaveBeenCalledWith('2032-12-31');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-PER-2: propaga errores inline al FormField de vigenteHasta.
  // ─────────────────────────────────────────────────────────────────
  describe('T-PER-2: propaga errores inline', () => {
    it('muestra errores.vigenteHasta inline en el FormField correspondiente', () => {
      const formState = buildFormStateMock({
        errors: {
          vigenteHasta: 'Vigente hasta debe ser posterior a vigente desde',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId, getByText } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      // FormField expone el error via sub-elemento `${testID}-error`.
      const errorHud = getByTestId('param-vigente-hasta-error');
      expect(errorHud).toBeTruthy();
      expect(getByText('Vigente hasta debe ser posterior a vigente desde')).toBeTruthy();
      // Sanity: el input debe tener aria-invalid=true.
      expect(getByTestId('param-vigente-hasta').props['aria-invalid']).toBe(true);
    });

    it('no muestra error si errores.vigenteHasta es undefined', () => {
      const formState = buildFormStateMock({ errors: {} });
      const getRef = buildGetRef();

      const { queryByTestId } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(queryByTestId('param-vigente-hasta-error')).toBeNull();
      expect(queryByTestId('param-vigente-hasta').props['aria-invalid']).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-PER-3: deshabilita los inputs cuando guardando=true o
  // cargandoInputs=true (consistente con el resto del form).
  // ─────────────────────────────────────────────────────────────────
  describe('T-PER-3: disabled state', () => {
    it('deshabilita los inputs cuando guardando=true', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={true}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-periodo').props.editable).toBe(false);
      expect(getByTestId('param-vigente-desde').props.editable).toBe(false);
      expect(getByTestId('param-vigente-hasta').props.editable).toBe(false);
    });

    it('deshabilita los inputs cuando cargandoInputs=true', () => {
      const formState = buildFormStateMock({ cargandoInputs: true });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-periodo').props.editable).toBe(false);
      expect(getByTestId('param-vigente-desde').props.editable).toBe(false);
      expect(getByTestId('param-vigente-hasta').props.editable).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-PER-4: accesibilidad / contract preservation.
  // ─────────────────────────────────────────────────────────────────
  describe('T-PER-4: accesibilidad de las fechas de vigencia', () => {
    it('preserva accessibilityHint verbatim del screen original', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-vigente-desde').props.accessibilityHint)
        .toBe('Fecha de inicio de vigencia del periodo tarifario');
      expect(getByTestId('param-vigente-hasta').props.accessibilityHint)
        .toBe('Fecha de fin de vigencia del periodo tarifario');
    });

    it('param-periodo es required=true (asterisco + "obligatorio" en a11y)', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId, UNSAFE_getByProps } = render(
        <ParametrosTarifaPeriodo
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      // FormField agrega ", obligatorio" al accessibilityLabel cuando required=true.
      expect(getByTestId('param-periodo').props.accessibilityLabel)
        .toContain('obligatorio');
      // Asterisco visual presente (FormField expone testID `${testID}-required`).
      // Patron copiado de FormField.test.tsx T-FF-2.
      const asterisco = UNSAFE_getByProps({ testID: 'param-periodo-required' });
      expect(asterisco).toBeTruthy();
    });
  });
});
