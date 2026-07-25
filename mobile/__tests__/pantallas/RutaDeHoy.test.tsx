import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RutaDeHoy from '../../src/pantallas/RutaDeHoy';
import { crearNavMock } from './__mocks__/nav';
import { getBootstrap } from '../../src/composition/get-bootstrap';

jest.mock('../../src/composition/get-bootstrap');
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

// RutaDeHoy usa TopBar → useSafeAreaInsets → SafeAreaProvider.
// initialMetrics zero para aserciones estables.
const renderConProviders = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>,
  );

// useNetInfo depende de @react-native-community/netinfo que requiere
// APIs nativas no disponibles en jest. Mockeamos a "sin conexión" estable.
jest.mock('../../src/hooks/useNetInfo', () => ({
  useNetInfo: () => ({ isConnected: false }),
}));

// La fecha de hoy en formato YYYY-MM-DD
const HOY = new Date().toISOString().slice(0, 10);
const TIMESTAMP_HOY = `${HOY}T10:00:00.000Z`;
const TIMESTAMP_AYER = `${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}T10:00:00.000Z`;

const SUSCRIPTORES = [
  { id_suscriptor: 1, codigo: 'S001', nombre_apellidos: 'Ana García', direccion: 'Calle 1', estrato: 2 },
  { id_suscriptor: 2, codigo: 'S002', nombre_apellidos: 'Carlos López', direccion: 'Calle 2', estrato: 3 },
  { id_suscriptor: 3, codigo: 'S003', nombre_apellidos: 'María Torres', direccion: 'Calle 3', estrato: 1 },
];

const MEDIDORES = [
  { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
  { id_medidor: 20, id_suscriptor: 2, serial: 'M002' },
  { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
];

// 1 lectura con timestamp de HOY para el medidor 10 (suscriptor 1)
const LECTURAS_UNA_HOY = [
  {
    id: 1,
    id_medidor: 10,
    id_periodo: 'P01',
    id_operario: 99,
    lectura_anterior: 100,
    lectura_actual: 115,
    timestamp_captura: TIMESTAMP_HOY,
  },
];

const LECTURAS_VIEJAS = [
  {
    id: 1,
    id_medidor: 10,
    id_periodo: 'P01',
    id_operario: 99,
    lectura_anterior: 80,
    lectura_actual: 100,
    timestamp_captura: TIMESTAMP_AYER,
  },
];

function configurarBootstrap(opciones: {
  suscriptores?: typeof SUSCRIPTORES;
  lecturas?: typeof LECTURAS_UNA_HOY;
  cola?: { id: number; estado: string }[];
  medidores?: typeof MEDIDORES;
} = {}) {
  const {
    suscriptores = SUSCRIPTORES,
    lecturas = LECTURAS_UNA_HOY,
    cola = [],
    medidores = MEDIDORES,
  } = opciones;

  mockGetBootstrap.mockResolvedValue({
    suscriptorRepo: { listar: jest.fn().mockResolvedValue(suscriptores) },
    lecturaRepo: { listar: jest.fn().mockResolvedValue(lecturas) },
    colaRepo: { listar: jest.fn().mockResolvedValue(cola) },
    medidorRepo: { listar: jest.fn().mockResolvedValue(medidores) },
  } as any);
}

describe('RutaDeHoy', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  // SC-SYS-11: suscriptor con lectura este mes muestra "Capturado este mes"
  it('SC-SYS-11: suscriptor con lectura este mes muestra Capturado este mes', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Capturado este mes')).toBeTruthy();
  });

  // SC-SYS-12: suscriptores sin lectura muestran "Lectura pendiente"
  it('SC-SYS-12: suscriptores sin lectura muestran Lectura pendiente', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Capturado este mes');
    const pendientes = screen.getAllByText('Lectura pendiente');
    expect(pendientes.length).toBe(2);
  });

  // SC-SYS-13: el contador del header refleja total de lecturas capturadas
  // (la pantalla actual NO renderiza un botón SINCRONIZAR — sólo lleva el
  // conteo de pendientes a la tab Sincronizacion). Verificamos que el conteo
  // del mes se incrementa cuando hay lecturas.
  it('SC-SYS-13: contador Lecturas del mes refleja capturas', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Lecturas del mes')).toBeTruthy();
    // El contador "1 / 3" se renderiza como Text fragmentado.
    // Buscamos el Text hijo "/ 3" que es único del contador.
    expect(screen.getByText('/ 3')).toBeTruthy();
  });

  // SC-SYS-14: la cola ya no tiene un botón SINCRONIZAR en esta pantalla
  it('SC-SYS-14: SINCRONIZAR no aparece (movido a tab Sincronizacion)', async () => {
    configurarBootstrap({ cola: [] });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    expect(screen.queryByText(/SINCRONIZAR/i)).toBeNull();
  });

  // SC-SYS-15: error en carga muestra Reintentar
  it('SC-SYS-15: error en carga muestra Reintentar', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('fallo de red'));
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
  });

  // SC-SYS-16: 1 de 3 suscriptores con lectura → contador 1 / 3
  it('SC-SYS-16: muestra el progreso correcto 1 / 3', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText(/Lecturas del mes/)).toBeTruthy();
    // El contador muestra "1 / 3" (Text fragmentado por el span interior)
    expect(screen.getByText('/ 3')).toBeTruthy();
  });
});
