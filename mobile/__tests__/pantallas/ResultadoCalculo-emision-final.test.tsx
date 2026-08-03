import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ResultadoCalculo from '../../src/pantallas/ResultadoCalculo';
import { crearNavMock } from './__mocks__/nav';

jest.mock('../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn(),
}));
jest.mock('../../dominio/factura/emitir-factura-movil', () => ({
  emitirFacturaMovil: jest.fn(),
}));

const mockGetBootstrap = require('../../src/composition/get-bootstrap').getBootstrap as jest.Mock;
const mockEmitirFacturaMovil = require('../../dominio/factura/emitir-factura-movil').emitirFacturaMovil as jest.Mock;

function renderConProviders(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );
}

function crearRuta() {
  return {
    key: 'resultado-test',
    name: 'ResultadoCalculo',
    params: {
      lectura: {
        id_medidor: 10,
        id_periodo: '202601',
        id_operario: 7,
        lectura_actual: 1012,
        lectura_anterior: 1000,
        estado_validacion: 'validado' as const,
        timestamp_captura: '2026-02-01T08:30:00.000Z',
        estado_sync: 'pendiente' as const,
        id_prestador: 1,
      },
      resultado: {
        id_prestador: 1,
        estrato: 2 as const,
        categoria_uso: 'residencial' as const,
        consumo_m3: 12,
        consumo_efectivo_m3: 12,
        bloques: [],
        cargo_fijo: 5000,
        cc_unitario: 1000,
        cc_total: 12000,
        subsidio: 0,
        contribucion: 0,
        total: 17000,
        factor_aplicado: 0,
        metadata: {
          norma_aplicada: 'Res CRA 825/2017',
          acuerdo_id: null,
          parametros_id: 1,
          cmviaa_aplicado: false,
          minimo_vital_aplicado: false,
          factor_capeado: false,
          version_motor: '825-907-v1',
          calculo_timestamp: '2026-02-01T10:00:00.000Z',
        },
      },
      parametros: { consumoBasico: 10 },
      estrato: 2,
      id_suscriptor: 1,
      nombre_suscriptor: 'Maria Lopez',
      prestador: {
        id_prestador: 1,
        codigo: 'P-1',
        nombre: 'Aguas de Cundinamarca',
        nit: '800.123.456-7',
        representante_legal: '',
        representante_legal_cedula: '',
        municipio: 'Bogota',
        departamento: 'Cundinamarca',
        segmento: 2,
        num_suscriptores_urbanos: 0,
        num_suscriptores_rurales: 1,
        contacto: null,
        estado: 'activo' as const,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        aps: null,
      },
      otros_valores: [],
      saldo_anterior: 0,
    },
  };
}

describe('ResultadoCalculo — emisión final', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBootstrap.mockResolvedValue({
      repos: {},
      adapters: { hasher: {}, idGenerator: {} },
      services: {},
    });
    mockEmitirFacturaMovil.mockResolvedValue({ id: 'factura-real-123', id_factura: 'factura-real-123' });
  });

  it('al tocar Ver factura completa emite la snapshot y navega con el id real', async () => {
    const navigation = crearNavMock();
    renderConProviders(
      <ResultadoCalculo
        navigation={navigation as any}
        route={crearRuta() as any}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ver-factura-completa'));
    });

    await waitFor(() => {
      expect(mockEmitirFacturaMovil).toHaveBeenCalledTimes(1);
      expect(navigation.navigate).toHaveBeenCalledWith('FacturaPreview', {
        id_factura: 'factura-real-123',
      });
    });
    expect(mockEmitirFacturaMovil.mock.calls[0]?.[1]).toMatchObject({
      lectura: expect.objectContaining({ id_medidor: 10 }),
      id_suscriptor: 1,
      resultado: expect.objectContaining({ total: 17000 }),
    });
  });

  it('si la emisión falla muestra error inline y no navega', async () => {
    const navigation = crearNavMock();
    mockEmitirFacturaMovil.mockRejectedValueOnce(new Error('suscriptor no encontrado'));
    renderConProviders(
      <ResultadoCalculo
        navigation={navigation as any}
        route={crearRuta() as any}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ver-factura-completa'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-emision')).toHaveTextContent('suscriptor no encontrado');
    });
    expect(navigation.navigate).not.toHaveBeenCalledWith(
      'FacturaPreview',
      expect.anything(),
    );
  });
});
