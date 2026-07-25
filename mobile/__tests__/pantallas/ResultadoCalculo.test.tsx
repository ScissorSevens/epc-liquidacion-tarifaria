import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ResultadoCalculo from '../../src/pantallas/ResultadoCalculo';
import { crearNavMock } from './__mocks__/nav';

// Mock mínimo de @react-navigation/native para evitar errores de contexto
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
}));

// TopBar (componente de la pantalla) usa useSafeAreaInsets → requiere
// SafeAreaProvider en el árbol. initialMetrics default = 0 en todas las
// dimensiones para mantener aserciones estables.
const renderConProviders = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 320, height: 568 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>{ui}</SafeAreaProvider>);

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
    consumo_m3: 15,
    consumo_efectivo_m3: 15,
    bloques: [],
    cargo_fijo: 5000,
    cc_unitario: 1333.33,
    cc_total: 20000,
    subsidio: 0,
    contribucion: 0,
    factor_aplicado: 0,
    metadata: {
      norma_aplicada: 'Res CRA 825/2017',
      acuerdo_id: null,
      parametros_id: 1,
      cmviaa_aplicado: false,
      minimo_vital_aplicado: false,
      factor_capeado: false,
      version_motor: '825-907-v1',
      calculo_timestamp: '2026-05-11T10:00:00.000Z',
    },
  },
  parametros: { consumoBasico: 10 },
  estrato: 2,
  id_suscriptor: 42,
  nombre_suscriptor: 'Juan Pérez',
  prestador: { nombre: 'EPC S.A.', municipio: 'Bogotá' },
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
    renderConProviders(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    // Intl.NumberFormat en JSDOM puede formatear con . o , según locale
    const elemento = screen.getByText(/1[.,\s]?234[.,\s]?567/);
    expect(elemento).toBeTruthy();
  });

  // SC-SYS-02: botón Ver historial navega a Historial
  it('SC-SYS-02: Ver historial llama navigation.navigate con Historial', () => {
    renderConProviders(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    fireEvent.press(screen.getByText('Ver historial'));
    expect(nav.navigate).toHaveBeenCalledWith('Historial', {
      id_suscriptor: paramsBase.id_suscriptor,
      nombre: paramsBase.nombre_suscriptor,
    });
  });

  // SC-SYS-03: botón Volver a la ruta llama replace con CapturarLectura
  it('SC-SYS-03: Volver a la ruta llama navigation.replace con CapturarLectura', () => {
    renderConProviders(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    fireEvent.press(screen.getByText('Volver a la ruta'));
    expect(nav.replace).toHaveBeenCalledWith('CapturarLectura', {
      id_medidor: paramsBase.lectura.id_medidor,
      id_suscriptor: paramsBase.id_suscriptor,
    });
  });

  // SC-SYS-04: toggle del detalle de cálculo oculta y vuelve a mostrar las filas
  it('SC-SYS-04: toggle de detalle oculta y muestra las filas', () => {
    renderConProviders(
      <ResultadoCalculo navigation={nav as any} route={crearRutaMock() as any} />,
    );
    // Detalle abierto por defecto → fila Cargo Fijo visible
    const filaCargoFijo = screen.getByText(/Cargo Fijo/);
    expect(filaCargoFijo).toBeTruthy();

    // Presionar toggle cierra el detalle
    fireEvent.press(screen.getByText('Detalle de cálculo'));
    expect(screen.queryByText(/Cargo Fijo/)).toBeNull();

    // Presionar de nuevo abre
    fireEvent.press(screen.getByText('Detalle de cálculo'));
    expect(screen.getByText(/Cargo Fijo/)).toBeTruthy();
  });

  // SC-SYS-05: sin foto muestra placeholder "— (sin evidencia foto)"
  it('SC-SYS-05: hashFoto null muestra texto de ausencia', () => {
    const paramsConFotoNull = {
      ...paramsBase,
      lectura: { ...paramsBase.lectura, evidencia: undefined },
    };
    renderConProviders(
      <ResultadoCalculo
        navigation={nav as any}
        route={crearRutaMock(paramsConFotoNull) as any}
      />,
    );
    expect(screen.getByText('— (sin evidencia foto)')).toBeTruthy();
  });
});
