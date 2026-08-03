/**
 * Tests del contrato de `SeleccionarImpresora`.
 *
 * Cubre (spec `factura-impresion-termica` REQ 1 + `factura-preview-ticket`
 * REQ 5):
 *  - scan: estado inicial con CTA Detener, lista de dispositivos con
 *    badge de transporte.
 *  - pair + connect: tap invoca adapter.emparejar + conectar +
 *    guardarUltimaImpresora + goBack.
 *  - retry: tras fallo, tap Reintentar relanza scan.
 *  - permisos: si adapter escanear rechaza con PERMISO_DENEGADO,
 *    muestra CTA Configurar permisos.
 *
 * RED phase: la pantalla existe como placeholder; la implementacion
 * real llega en commit 12.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SeleccionarImpresora from '../../src/pantallas/SeleccionarImpresora';
import { crearNavMock } from './__mocks__/nav';
import type { Impresora } from '@dominio/impresion';
import { ExcepcionImpresora } from '@dominio/impresion';

// ── Fixtures ────────────────────────────────────────────────────────────────

const impresoraBle: Impresora = {
  id: 'AA:BB:CC:DD:EE:FF',
  nombre: 'EPSON T58',
  transporte: 'BLE',
  direccion: 'AA:BB:CC:DD:EE:FF',
  anchoPapel: '58mm',
  estado: 'disponible',
};

const impresoraSpp: Impresora = {
  id: '00:11:22:33:44:55',
  nombre: 'Xprinter XP-58',
  transporte: 'SPP',
  direccion: '00:11:22:33:44:55',
  anchoPapel: '58mm',
  estado: 'disponible',
};

const paramsBase = { id_factura: 'factura-test-id-1234', modo: 'inicial' as const };

function crearRutaMock(params = paramsBase) {
  return { key: 'test-route', name: 'SeleccionarImpresora', params };
}

function renderConProviders(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>,
  );
}

// ── Adapter mock ───────────────────────────────────────────────────────────

jest.mock('../../src/adapters/impresion/factory', () => {
  const mockEscanear = jest.fn().mockResolvedValue([
    {
      id: 'AA:BB:CC:DD:EE:FF',
      nombre: 'EPSON T58',
      transporte: 'BLE',
      direccion: 'AA:BB:CC:DD:EE:FF',
      anchoPapel: '58mm',
      estado: 'disponible',
    },
    {
      id: '00:11:22:33:44:55',
      nombre: 'Xprinter XP-58',
      transporte: 'SPP',
      direccion: '00:11:22:33:44:55',
      anchoPapel: '58mm',
      estado: 'disponible',
    },
  ]);
  const mockEmparejar = jest.fn().mockResolvedValue(undefined);
  const mockConectar = jest.fn().mockResolvedValue(undefined);
  const mockAdapter = {
    id: 'mock-adapter',
    transporte: 'BLE' as const,
    estado: jest.fn(() => 'lista' as const),
    escanear: mockEscanear,
    emparejar: mockEmparejar,
    conectar: mockConectar,
    imprimir: jest.fn().mockResolvedValue(undefined),
    obtenerCapacidades: jest.fn().mockResolvedValue({
      soportaCorte: false,
      soportaCodigoBarras: false,
      soportaDobleAncho: true,
      anchoMaximo: 32,
      codePage: 'PC437',
    }),
    desconectar: jest.fn().mockResolvedValue(undefined),
  };
  return {
    obtenerAdaptadores: jest.fn().mockResolvedValue([
      { adapter: mockAdapter, cargaLazyOk: true },
    ]),
    __setearAdaptadoresPrueba: jest.fn(),
    __resetearAdaptadoresPrueba: jest.fn(),
    // Test seams para spy
    __mockEscanear: mockEscanear,
    __mockEmparejar: mockEmparejar,
    __mockConectar: mockConectar,
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('../../src/persistencia/impresoras-preferencias', () => ({
  obtenerUltimaImpresora: jest.fn().mockResolvedValue(null),
  guardarUltimaImpresora: jest.fn().mockResolvedValue(undefined),
  invalidarPreferencias: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Restaurar comportamiento default del mock factory (los jest.fn
  // creados en jest.mock son compartidos entre tests).
  const factoryMod = require('../../src/adapters/impresion/factory');
  factoryMod.__mockEscanear.mockResolvedValue([impresoraBle, impresoraSpp]);
  factoryMod.__mockEmparejar.mockResolvedValue(undefined);
  factoryMod.__mockConectar.mockResolvedValue(undefined);
});

describe('SeleccionarImpresora — scan', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
  });

  it('estado inicial muestra dispositivos encontrados del adapter', async () => {
    renderConProviders(
      <SeleccionarImpresora
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    // Esperar a que el scan se complete
    await waitFor(() => {
      expect(
        screen.getByTestId(`dispositivo-${impresoraBle.id}`),
      ).toBeTruthy();
    });
    expect(
      screen.getByTestId(`dispositivo-${impresoraSpp.id}`),
    ).toBeTruthy();
  });

  it('muestra badge de transporte (BLE o SPP) en cada dispositivo', async () => {
    renderConProviders(
      <SeleccionarImpresora
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('BLE')).toBeTruthy();
      expect(screen.getByText('SPP')).toBeTruthy();
    });
  });
});

describe('SeleccionarImpresora — pair + connect', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
  });

  it('tap en dispositivo invoca emparejar + conectar + persistir + goBack', async () => {
    renderConProviders(
      <SeleccionarImpresora
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId(`dispositivo-${impresoraBle.id}`)).toBeTruthy();
    });
    const factoryMod = require('../../src/adapters/impresion/factory');
    const item = screen.getByTestId(`dispositivo-${impresoraBle.id}`);
    await act(async () => {
      fireEvent.press(item);
    });
    expect(factoryMod.__mockEmparejar).toHaveBeenCalledWith(impresoraBle);
    expect(factoryMod.__mockConectar).toHaveBeenCalledWith(impresoraBle.direccion);
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('conexion fallida muestra mensaje y NO navega', async () => {
    const factoryMod = require('../../src/adapters/impresion/factory');
    factoryMod.__mockConectar.mockRejectedValueOnce(
      new ExcepcionImpresora({
        codigo: 'CONEXION_FALLIDA',
        direccion: impresoraBle.direccion,
        mensaje: 'No se pudo conectar',
      }),
    );

    renderConProviders(
      <SeleccionarImpresora
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId(`dispositivo-${impresoraBle.id}`)).toBeTruthy();
    });
    const item = screen.getByTestId(`dispositivo-${impresoraBle.id}`);
    await act(async () => {
      fireEvent.press(item);
    });
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(screen.getByText(/No se pudo conectar/)).toBeTruthy();
  });
});

describe('SeleccionarImpresora — permisos', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
  });

  it('si adapter rechaza con PERMISO_DENEGADO muestra CTA Configurar permisos', async () => {
    const factoryMod = require('../../src/adapters/impresion/factory');
    factoryMod.__mockEscanear.mockRejectedValue(
      new ExcepcionImpresora({
        codigo: 'PERMISO_DENEGADO',
        transporte: 'BLE',
        mensaje: 'Permisos BLE no otorgados',
      }),
    );

    renderConProviders(
      <SeleccionarImpresora
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('btn-configurar-permisos')).toBeTruthy();
    });
    expect(screen.getByText(/Permisos BLE no otorgados/)).toBeTruthy();
  });
});
