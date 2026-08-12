// mobile/__tests__/pantallas/admin/componentes/ParametrosTarifaSoporte.test.tsx
//
// Tests contractuales del subcomponente `ParametrosTarifaSoporte` —
// sección "Soporte documental" del screen admin ParametrosTarifa
// (parametros-tarifa-screen-decomposition Phase 2 task 2.5).
//
// Cobertura (4 tests):
//   T-SOP-1: renderiza los 3 inputs (param-acto-adopcion,
//            param-estudio-costos-id, param-documento-soporte-url).
//   T-SOP-2: propaga errores.actoAdopcion y errores.documentoSoporteUrl
//            inline (URLs inválidas detonan error).
//   T-SOP-3: helperText verbatim del screen original (SUI, "URL, PDF u otro").
//   T-SOP-4: disabled state cuando guardando=true o cargandoInputs=true.
//
// TDD Evidence:
//   RED  → componente no existe. Import tira Cannot find module.
//   GREEN → implementación en
//          `mobile/src/pantallas/admin/componentes/ParametrosTarifaSoporte.tsx`.

import * as React from 'react';
import type { RefObject } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { View } from 'react-native';

import { ParametrosTarifaSoporte } from '../../../../src/pantallas/admin/componentes/ParametrosTarifaSoporte';
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
  readonly setActoAdopcion?: (v: string) => void;
  readonly setEstudioCostosId?: (v: string) => void;
  readonly setDocumentoSoporteUrl?: (v: string) => void;
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
    setActoAdopcion: opts.setActoAdopcion ?? jest.fn(),
    setEstudioCostosId: opts.setEstudioCostosId ?? jest.fn(),
    setDocumentoSoporteUrl: opts.setDocumentoSoporteUrl ?? jest.fn(),
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

function buildGetRef(): (
  key: 'actoAdopcion' | 'documentoSoporteUrl',
) => RefObject<View | null> {
  const refs: Record<string, RefObject<View | null>> = {};
  return (key) => {
    if (refs[key] === undefined) refs[key] = { current: null };
    return refs[key] as RefObject<View | null>;
  };
}

describe('ParametrosTarifaSoporte — sección "Soporte documental"', () => {
  // ─────────────────────────────────────────────────────────────────
  // T-SOP-1: renderiza los 3 inputs.
  // ─────────────────────────────────────────────────────────────────
  describe('T-SOP-1: renderiza los 3 inputs', () => {
    it('renderiza param-acto-adopcion + param-estudio-costos-id + param-documento-soporte-url', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaSoporte
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-acto-adopcion')).toBeTruthy();
      expect(getByTestId('param-estudio-costos-id')).toBeTruthy();
      expect(getByTestId('param-documento-soporte-url')).toBeTruthy();
    });

    it('los inputs muestran el valor controlado desde formState.values', () => {
      const formState = buildFormStateMock({
        values: {
          actoAdopcion: 'https://example.com/decreto-042-2024',
          estudioCostosId: 'SUI-2024-EST-001',
          documentoSoporteUrl: 'https://example.com/estudio.pdf',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaSoporte
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-acto-adopcion').props.value).toBe(
        'https://example.com/decreto-042-2024',
      );
      expect(getByTestId('param-estudio-costos-id').props.value).toBe('SUI-2024-EST-001');
      expect(getByTestId('param-documento-soporte-url').props.value).toBe(
        'https://example.com/estudio.pdf',
      );
    });

    it('cambia valor → llama el setter correspondiente', () => {
      const setActoAdopcion = jest.fn();
      const setEstudioCostosId = jest.fn();
      const setDocumentoSoporteUrl = jest.fn();
      const formState = buildFormStateMock({
        setActoAdopcion,
        setEstudioCostosId,
        setDocumentoSoporteUrl,
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaSoporte
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      fireEvent.changeText(
        getByTestId('param-acto-adopcion'),
        'https://example.com/decreto-001',
      );
      fireEvent.changeText(getByTestId('param-estudio-costos-id'), 'SUI-2024-EST-002');
      fireEvent.changeText(
        getByTestId('param-documento-soporte-url'),
        'https://example.com/estudio-2.pdf',
      );

      expect(setActoAdopcion).toHaveBeenCalledWith('https://example.com/decreto-001');
      expect(setEstudioCostosId).toHaveBeenCalledWith('SUI-2024-EST-002');
      expect(setDocumentoSoporteUrl).toHaveBeenCalledWith(
        'https://example.com/estudio-2.pdf',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-SOP-2: propaga errores.actoAdopcion y errores.documentoSoporteUrl.
  // ─────────────────────────────────────────────────────────────────
  describe('T-SOP-2: propaga errores inline', () => {
    it('muestra errores.actoAdopcion y errores.documentoSoporteUrl', () => {
      const formState = buildFormStateMock({
        errors: {
          actoAdopcion: 'Debe ser una URL válida (http:// o https://)',
          documentoSoporteUrl: 'Debe ser una URL válida (http:// o https://)',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId, getAllByText } = render(
        <ParametrosTarifaSoporte
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-acto-adopcion-error')).toBeTruthy();
      expect(getByTestId('param-documento-soporte-url-error')).toBeTruthy();
      // El mensaje aparece en los dos errores.
      expect(
        getAllByText('Debe ser una URL válida (http:// o https://)').length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-SOP-3: helperTexts verbatim del screen original.
  // ─────────────────────────────────────────────────────────────────
  describe('T-SOP-3: helperTexts preservados', () => {
    it('param-estudio-costos-id muestra el helperText "SUI"', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByText } = render(
        <ParametrosTarifaSoporte
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(
        getByText(
          'Identificador del estudio de costos en el sistema externo (SUI o similar). String libre.',
        ),
      ).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-SOP-4: disabled state.
  // ─────────────────────────────────────────────────────────────────
  describe('T-SOP-4: disabled state', () => {
    it('deshabilita los inputs cuando guardando=true', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaSoporte
          formState={formState}
          guardando={true}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-acto-adopcion').props.editable).toBe(false);
      expect(getByTestId('param-estudio-costos-id').props.editable).toBe(false);
      expect(getByTestId('param-documento-soporte-url').props.editable).toBe(false);
    });

    it('deshabilita los inputs cuando cargandoInputs=true', () => {
      const formState = buildFormStateMock({ cargandoInputs: true });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaSoporte
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-acto-adopcion').props.editable).toBe(false);
      expect(getByTestId('param-estudio-costos-id').props.editable).toBe(false);
      expect(getByTestId('param-documento-soporte-url').props.editable).toBe(false);
    });
  });
});
