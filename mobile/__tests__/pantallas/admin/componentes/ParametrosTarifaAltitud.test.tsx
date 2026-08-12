// mobile/__tests__/pantallas/admin/componentes/ParametrosTarifaAltitud.test.tsx
//
// Tests contractuales del subcomponente `ParametrosTarifaAltitud` —
// sección "Altitud y consumo basico" del screen admin ParametrosTarifa
// (parametros-tarifa-screen-decomposition Phase 2 task 2.4).
//
// Cobertura (4 tests):
//   T-ALT-1: renderiza el input `param-altitud` con valor controlado.
//   T-ALT-2: muestra el preview live `param-altitud-preview` con
//            el limite de consumo basico calculado.
//   T-ALT-3: el preview refleja el cambio cuando el usuario edita la
//            altitud (live preview via `limiteConsumoBasicoMensual`).
//   T-ALT-4: disabled state cuando guardando=true o cargandoInputs=true.
//
// TDD Evidence:
//   RED  → componente no existe. Import tira Cannot find module.
//   GREEN → implementación en
//          `mobile/src/pantallas/admin/componentes/ParametrosTarifaAltitud.tsx`.

import * as React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ParametrosTarifaAltitud } from '../../../../src/pantallas/admin/componentes/ParametrosTarifaAltitud';
import type { FormValues } from '../../../../src/pantallas/admin/parametros-tarifa-build-borrador';
import type {
  FormSetters,
  UseParametrosFormStateReturn,
} from '../../../../src/pantallas/admin/hooks/useParametrosFormState';

function buildFormStateMock(opts: {
  readonly values?: Partial<FormValues>;
  readonly cargandoInputs?: boolean;
  readonly setAltitud?: (v: string) => void;
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
    setAguaSuministrada: jest.fn(),
    setIpuf: jest.fn(),
    setSuscriptoresPromedio: jest.fn(),
    setVigenteDesde: jest.fn(),
    setVigenteHasta: jest.fn(),
    setAltitud: opts.setAltitud ?? jest.fn(),
  };
  return {
    values,
    setters,
    errores: {},
    setErrores: jest.fn(),
    cargando: false,
    cargandoInputs: opts.cargandoInputs ?? false,
    validarTodo: jest.fn().mockReturnValue({}),
    guardar: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ParametrosTarifaAltitud — sección "Altitud y consumo basico"', () => {
  // ─────────────────────────────────────────────────────────────────
  // T-ALT-1: renderiza el input `param-altitud`.
  // ─────────────────────────────────────────────────────────────────
  describe('T-ALT-1: renderiza el input altitud', () => {
    it('renderiza param-altitud con valor controlado', () => {
      const formState = buildFormStateMock({ values: { altitud: '2600' } });

      const { getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState} guardando={false} />,
      );

      expect(getByTestId('param-altitud')).toBeTruthy();
      expect(getByTestId('param-altitud').props.value).toBe('2600');
    });

    it('cambia valor → llama setAltitud', () => {
      const setAltitud = jest.fn();
      const formState = buildFormStateMock({ setAltitud });

      const { getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState} guardando={false} />,
      );

      fireEvent.changeText(getByTestId('param-altitud'), '800');

      expect(setAltitud).toHaveBeenCalledWith('800');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-ALT-2: preview live con el límite de consumo básico.
  // ─────────────────────────────────────────────────────────────────
  describe('T-ALT-2: preview live limite de consumo basico', () => {
    it('renderiza param-altitud-preview con el limite 11 m3 para altitud >2.000', () => {
      const formState = buildFormStateMock({ values: { altitud: '2600' } });

      const { getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState} guardando={false} />,
      );

      const preview = getByTestId('param-altitud-preview');
      expect(preview).toBeTruthy();
      // Texto contiene "11 m3/mes" (Res CRA 750/2016: > 2000 msnm → 11 m3).
      expect(preview.props.children).toContain('11 m³/mes');
    });

    it('renderiza param-altitud-preview con el limite 13 m3 para altitud 1.000-2.000', () => {
      const formState = buildFormStateMock({ values: { altitud: '1500' } });

      const { getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState} guardando={false} />,
      );

      const preview = getByTestId('param-altitud-preview');
      expect(preview.props.children).toContain('13 m³/mes');
    });

    it('renderiza param-altitud-preview con el limite 16 m3 para altitud <=1.000', () => {
      const formState = buildFormStateMock({ values: { altitud: '500' } });

      const { getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState} guardando={false} />,
      );

      const preview = getByTestId('param-altitud-preview');
      expect(preview.props.children).toContain('16 m³/mes');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-ALT-3: el preview refleja el cambio al editar.
  // ─────────────────────────────────────────────────────────────────
  describe('T-ALT-3: el preview refleja cambios de altitud', () => {
    it('al cambiar altitud de 500 a 2600, el preview pasa de 16 a 11 m3', () => {
      const setAltitud = jest.fn();
      // Primer render con altitud=500 → preview 16 m3.
      const formState1 = buildFormStateMock({
        values: { altitud: '500' },
        setAltitud,
      });

      const { rerender, getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState1} guardando={false} />,
      );

      expect(getByTestId('param-altitud-preview').props.children).toContain('16 m³/mes');

      // Simulamos cambio de altitud via re-render con nuevo state.
      const formState2 = buildFormStateMock({
        values: { altitud: '2600' },
        setAltitud,
      });

      rerender(<ParametrosTarifaAltitud formState={formState2} guardando={false} />);

      expect(getByTestId('param-altitud-preview').props.children).toContain('11 m³/mes');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-ALT-4: disabled state.
  // ─────────────────────────────────────────────────────────────────
  describe('T-ALT-4: disabled state', () => {
    it('deshabilita el input cuando guardando=true', () => {
      const formState = buildFormStateMock({});

      const { getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState} guardando={true} />,
      );

      expect(getByTestId('param-altitud').props.editable).toBe(false);
    });

    it('deshabilita el input cuando cargandoInputs=true', () => {
      const formState = buildFormStateMock({ cargandoInputs: true });

      const { getByTestId } = render(
        <ParametrosTarifaAltitud formState={formState} guardando={false} />,
      );

      expect(getByTestId('param-altitud').props.editable).toBe(false);
    });
  });
});
