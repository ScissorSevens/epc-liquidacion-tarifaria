// mobile/__tests__/pantallas/admin/componentes/ParametrosTarifaIPC.test.tsx
//
// Tests contractuales del subcomponente `ParametrosTarifaIPC` —
// sección "Indexación IPC" del screen admin ParametrosTarifa
// (parametros-tarifa-screen-decomposition Phase 2 task 2.6).
//
// Cobertura (5 tests):
//   T-IPC-1: renderiza los 4 inputs (param-anio-base-ipc,
//            param-anio-destino, param-factor-ipc, param-ipuf-indice).
//   T-IPC-2: propaga errores de los 4 inputs inline.
//   T-IPC-3: preview live `param-ipc-preview` con
//            `calcularFactorIpc(anioBase, anioDestino).toFixed(4)`.
//   T-IPC-4: helperTexts verbatim del screen original (CRA 825 Art. 7/11).
//   T-IPC-5: disabled state cuando guardando=true o cargandoInputs=true.
//
// TDD Evidence:
//   RED  → componente no existe. Import tira Cannot find module.
//   GREEN → implementación en
//          `mobile/src/pantallas/admin/componentes/ParametrosTarifaIPC.tsx`.

import * as React from 'react';
import type { RefObject } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { View } from 'react-native';

import { ParametrosTarifaIPC } from '../../../../src/pantallas/admin/componentes/ParametrosTarifaIPC';
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
  readonly setAnioBase?: (v: string) => void;
  readonly setAnioDestino?: (v: string) => void;
  readonly setFactorIpc?: (v: string) => void;
  readonly setIpufIndice?: (v: string) => void;
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
    setAnioBase: opts.setAnioBase ?? jest.fn(),
    setAnioDestino: opts.setAnioDestino ?? jest.fn(),
    setFactorIpc: opts.setFactorIpc ?? jest.fn(),
    setIpufIndice: opts.setIpufIndice ?? jest.fn(),
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
  key: 'anioBase' | 'anioDestino' | 'factorIpc' | 'ipufIndice',
) => RefObject<View | null> {
  const refs: Record<string, RefObject<View | null>> = {};
  return (key) => {
    if (refs[key] === undefined) refs[key] = { current: null };
    return refs[key] as RefObject<View | null>;
  };
}

describe('ParametrosTarifaIPC — sección "Indexación IPC"', () => {
  // ─────────────────────────────────────────────────────────────────
  // T-IPC-1: renderiza los 4 inputs.
  // ─────────────────────────────────────────────────────────────────
  describe('T-IPC-1: renderiza los 4 inputs', () => {
    it('renderiza param-anio-base-ipc + param-anio-destino + param-factor-ipc + param-ipuf-indice', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-anio-base-ipc')).toBeTruthy();
      expect(getByTestId('param-anio-destino')).toBeTruthy();
      expect(getByTestId('param-factor-ipc')).toBeTruthy();
      expect(getByTestId('param-ipuf-indice')).toBeTruthy();
    });

    it('los inputs muestran el valor controlado desde formState.values', () => {
      const formState = buildFormStateMock({
        values: {
          anioBase: '2016',
          anioDestino: '2026',
          factorIpc: '1.6234',
          ipufIndice: '1.05',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-anio-base-ipc').props.value).toBe('2016');
      expect(getByTestId('param-anio-destino').props.value).toBe('2026');
      expect(getByTestId('param-factor-ipc').props.value).toBe('1.6234');
      expect(getByTestId('param-ipuf-indice').props.value).toBe('1.05');
    });

    it('cambia valor → llama el setter correspondiente', () => {
      const setAnioBase = jest.fn();
      const setAnioDestino = jest.fn();
      const setFactorIpc = jest.fn();
      const setIpufIndice = jest.fn();
      const formState = buildFormStateMock({
        setAnioBase,
        setAnioDestino,
        setFactorIpc,
        setIpufIndice,
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      fireEvent.changeText(getByTestId('param-anio-base-ipc'), '2018');
      fireEvent.changeText(getByTestId('param-anio-destino'), '2027');
      fireEvent.changeText(getByTestId('param-factor-ipc'), '1.5');
      fireEvent.changeText(getByTestId('param-ipuf-indice'), '1.1');

      expect(setAnioBase).toHaveBeenCalledWith('2018');
      expect(setAnioDestino).toHaveBeenCalledWith('2027');
      expect(setFactorIpc).toHaveBeenCalledWith('1.5');
      expect(setIpufIndice).toHaveBeenCalledWith('1.1');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-IPC-2: propaga errores de los 4 inputs.
  // ─────────────────────────────────────────────────────────────────
  describe('T-IPC-2: propaga errores inline', () => {
    it('muestra los 4 errores inline', () => {
      const formState = buildFormStateMock({
        errors: {
          anioBase: 'Anio base debe ser > 2000',
          anioDestino: 'Anio destino debe ser > 2000',
          factorIpc: 'Factor IPC debe ser > 0',
          ipufIndice: 'IPUF indice debe ser > 0',
        },
      });
      const getRef = buildGetRef();

      const { getByTestId, getByText } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-anio-base-ipc-error')).toBeTruthy();
      expect(getByTestId('param-anio-destino-error')).toBeTruthy();
      expect(getByTestId('param-factor-ipc-error')).toBeTruthy();
      expect(getByTestId('param-ipuf-indice-error')).toBeTruthy();
      expect(getByText('Anio base debe ser > 2000')).toBeTruthy();
      expect(getByText('Anio destino debe ser > 2000')).toBeTruthy();
      expect(getByText('Factor IPC debe ser > 0')).toBeTruthy();
      expect(getByText('IPUF indice debe ser > 0')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-IPC-3: preview live con calcularFactorIpc.
  // ─────────────────────────────────────────────────────────────────
  describe('T-IPC-3: preview live del factor IPC', () => {
    it('renderiza param-ipc-preview con factor calculado 2016→2026', () => {
      const formState = buildFormStateMock({
        values: { anioBase: '2016', anioDestino: '2026' },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      const preview = getByTestId('param-ipc-preview');
      expect(preview).toBeTruthy();
      // El factor IPC 2016→2026 es 1.6234 (4 decimales).
      expect(preview.props.children).toContain('1.6234');
    });

    it('renderiza param-ipc-preview con factor 1.0000 cuando anioBase === anioDestino', () => {
      const formState = buildFormStateMock({
        values: { anioBase: '2026', anioDestino: '2026' },
      });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      const preview = getByTestId('param-ipc-preview');
      expect(preview.props.children).toContain('1.0000');
    });

    it('el preview se actualiza al cambiar anioDestino', () => {
      const setAnioDestino = jest.fn();
      const formState1 = buildFormStateMock({
        values: { anioBase: '2016', anioDestino: '2026' },
        setAnioDestino,
      });
      const getRef = buildGetRef();

      const { rerender, getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState1}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-ipc-preview').props.children).toContain('1.6234');

      const formState2 = buildFormStateMock({
        values: { anioBase: '2016', anioDestino: '2020' },
        setAnioDestino,
      });

      rerender(
        <ParametrosTarifaIPC
          formState={formState2}
          guardando={false}
          getRef={getRef}
        />,
      );

      // 2016→2020 factor > 1.0 pero no exactamente 1.6234.
      const previewText = getByTestId('param-ipc-preview').props.children as string;
      expect(previewText).not.toContain('1.6234');
      expect(previewText).toContain('2016');
      expect(previewText).toContain('2020');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-IPC-4: helperTexts verbatim del screen original.
  // ─────────────────────────────────────────────────────────────────
  describe('T-IPC-4: helperTexts preservados', () => {
    it('param-anio-base-ipc helperText "Norma CRA 825: anio_base=2016 (default)"', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByText } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(
        getByText('Norma CRA 825: anio_base=2016 (default). Año de referencia para la tabla IPC del DANE.'),
      ).toBeTruthy();
    });

    it('param-factor-ipc helperText "Default 1.0 (sin indexación)"', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByText } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(
        getByText('Default 1.0 (sin indexación). El admin puede override manual sobre el factor calculado.'),
      ).toBeTruthy();
    });

    it('param-ipuf-indice helperText "Multiplicador del IPUF (Res CRA 825 Art. 7)"', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByText } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(
        getByText('Multiplicador del IPUF (Res CRA 825 Art. 7). Default 1.0 (sin ajuste).'),
      ).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-IPC-5: disabled state.
  // ─────────────────────────────────────────────────────────────────
  describe('T-IPC-5: disabled state', () => {
    it('deshabilita los inputs cuando guardando=true', () => {
      const formState = buildFormStateMock({});
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={true}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-anio-base-ipc').props.editable).toBe(false);
      expect(getByTestId('param-anio-destino').props.editable).toBe(false);
      expect(getByTestId('param-factor-ipc').props.editable).toBe(false);
      expect(getByTestId('param-ipuf-indice').props.editable).toBe(false);
    });

    it('deshabilita los inputs cuando cargandoInputs=true', () => {
      const formState = buildFormStateMock({ cargandoInputs: true });
      const getRef = buildGetRef();

      const { getByTestId } = render(
        <ParametrosTarifaIPC
          formState={formState}
          guardando={false}
          getRef={getRef}
        />,
      );

      expect(getByTestId('param-anio-base-ipc').props.editable).toBe(false);
      expect(getByTestId('param-anio-destino').props.editable).toBe(false);
      expect(getByTestId('param-factor-ipc').props.editable).toBe(false);
      expect(getByTestId('param-ipuf-indice').props.editable).toBe(false);
    });
  });
});
