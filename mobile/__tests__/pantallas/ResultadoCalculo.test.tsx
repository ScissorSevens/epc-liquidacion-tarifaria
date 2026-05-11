import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ResultadoCalculo from '../../src/pantallas/ResultadoCalculo';
import { crearNavMock } from './__mocks__/nav';

// Mock mínimo de @react-navigation/native para evitar errores de contexto
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
}));

const paramsBase = {
  lectura: {
    id_medidor: 1,
    id_periodo: 'P01',
    id_operario: 99,
    lectura_anterior: 100,
    lectura_actual: 115,
    timestamp_captura: '2026-05-11T10:00:00.000Z',
    evidencia: undefined,
  },
  resultado: {
    total: 1234567,
    consumo: 15,
    consumoBasico: 10,
    consumoExcedente: 5,
    cargoFijo: 5000,
    cargoConsumo: 20000,
    cargoExcedente: 10000,
    subsidio: 0,
    contribucion: 0,
  },
  parametros: { consumoBasico: 10 },
  estrato: 2,
  id_suscriptor: 42,
};

function crearRutaMock(params = paramsBase) {
  return { key: 'test-route', name: 'ResultadoCalculo', params };
}

describe('ResultadoCalculo', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  // SC-SYS-01: total COP formateado con separadores de miles
  it('SC-SYS-01: muestra el total con separadores de miles', () => {
    render(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    // Intl.NumberFormat en JSDOM puede formatear con . o , según locale
    const elemento = screen.getByText(/1[.,\s]?234[.,\s]?567/);
    expect(elemento).toBeTruthy();
  });

  // SC-SYS-02: botón VER HISTORIAL llama popToTop
  it('SC-SYS-02: VER HISTORIAL llama navigation.popToTop()', () => {
    render(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    fireEvent.press(screen.getByText('VER HISTORIAL'));
    expect(nav.popToTop).toHaveBeenCalledTimes(1);
  });

  // SC-SYS-03: botón VOLVER A LA RUTA llama replace con CapturarLectura
  it('SC-SYS-03: VOLVER A LA RUTA llama navigation.replace con CapturarLectura', () => {
    render(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    fireEvent.press(screen.getByText('VOLVER A LA RUTA'));
    expect(nav.replace).toHaveBeenCalledWith('CapturarLectura', {
      id_medidor: paramsBase.lectura.id_medidor,
      id_suscriptor: paramsBase.id_suscriptor,
    });
  });

  // SC-SYS-04: toggle del detalle de cálculo oculta y vuelve a mostrar las filas
  it('SC-SYS-04: toggle de detalle oculta y muestra las filas', () => {
    render(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    // Detalle abierto por defecto → Cargo Fijo visible
    expect(screen.getByText('Cargo Fijo')).toBeTruthy();

    // Presionar toggle cierra el detalle
    fireEvent.press(screen.getByText('Detalle de cálculo'));
    expect(screen.queryByText('Cargo Fijo')).toBeNull();

    // Presionar de nuevo abre
    fireEvent.press(screen.getByText('Detalle de cálculo'));
    expect(screen.getByText('Cargo Fijo')).toBeTruthy();
  });

  // SC-SYS-05: sin foto muestra placeholder "— (sin evidencia foto)"
  it('SC-SYS-05: hashFoto null muestra texto de ausencia', () => {
    const paramsConFotoNull = {
      ...paramsBase,
      lectura: { ...paramsBase.lectura, evidencia: undefined },
    };
    render(
      <ResultadoCalculo
        navigation={nav as any}
        route={crearRutaMock(paramsConFotoNull) as any}
      />,
    );
    expect(screen.getByText('— (sin evidencia foto)')).toBeTruthy();
  });
});
