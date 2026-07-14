import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ListaSuscriptores from '../../src/pantallas/ListaSuscriptores';
import { crearNavMock } from './__mocks__/nav';
import { getBootstrap } from '../../src/composition/get-bootstrap';

jest.mock('../../src/composition/get-bootstrap');
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

// ListaSuscriptores usa TopBar → useSafeAreaInsets → SafeAreaProvider.
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

// useNetInfo (consumido transitivamente via RutaDeHoy navigation banner? —
// no, esta pantalla no lo usa directamente; pero algunas de sus
// dependencias internas podrían requerirlo). Mock defensivo.
jest.mock('../../src/hooks/useNetInfo', () => ({
  useNetInfo: () => ({ isConnected: false }),
}));

const SUSCRIPTORES_DEFECTO = [
  {
    id_suscriptor: 1,
    codigo: 'S001',
    nombre_apellidos: 'Ana García',
    direccion: 'Calle 1',
    estrato: 2,
  },
  {
    id_suscriptor: 2,
    codigo: 'S002',
    nombre_apellidos: 'Carlos López',
    direccion: 'Calle 2',
    estrato: 3,
  },
  {
    id_suscriptor: 3,
    codigo: 'S003',
    nombre_apellidos: 'María Torres',
    direccion: 'Calle 3',
    estrato: 1,
  },
];

function configurarBootstrap(lista = SUSCRIPTORES_DEFECTO) {
  mockGetBootstrap.mockResolvedValue({
    suscriptorRepo: { listar: jest.fn().mockResolvedValue(lista) },
  } as any);
}

describe('ListaSuscriptores', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  // SC-SYS-06: lista con 3 suscriptores
  it('SC-SYS-06: muestra los 3 suscriptores', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Ana García')).toBeTruthy();
    expect(await screen.findByText('Carlos López')).toBeTruthy();
    expect(await screen.findByText('María Torres')).toBeTruthy();
  });

  // SC-SYS-07: filtro por nombre reduce la lista
  it('SC-SYS-07: filtro por "ana" muestra solo Ana García', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const input = screen.getByPlaceholderText('Buscar por nombre o ID de suscriptor...');
    fireEvent.changeText(input, 'ana');
    expect(screen.getByText('Ana García')).toBeTruthy();
    expect(screen.queryByText('Carlos López')).toBeNull();
    expect(screen.queryByText('María Torres')).toBeNull();
  });

  // SC-SYS-08: búsqueda sin resultados muestra "Sin resultados"
  it('SC-SYS-08: búsqueda "xyz" muestra Sin resultados', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const input = screen.getByPlaceholderText('Buscar por nombre o ID de suscriptor...');
    fireEvent.changeText(input, 'xyz');
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });

  // SC-SYS-09: error en carga muestra REINTENTAR
  it('SC-SYS-09: error en carga muestra botón REINTENTAR', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('db error'));
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('REINTENTAR')).toBeTruthy();
  });

  // SC-SYS-10: lista vacía — no muestra suscriptores y conserva input de búsqueda
  it('SC-SYS-10: lista vacía no muestra suscriptores pero conserva la búsqueda', async () => {
    configurarBootstrap([]);
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    // El input de búsqueda debe estar presente
    const input = screen.getByPlaceholderText('Buscar por nombre o ID de suscriptor...');
    expect(input).toBeTruthy();
    // Ningún suscriptor renderiza
    expect(screen.queryByText('Ana García')).toBeNull();
    expect(screen.queryByText('Carlos López')).toBeNull();
    expect(screen.queryByText('María Torres')).toBeNull();
  });
});
