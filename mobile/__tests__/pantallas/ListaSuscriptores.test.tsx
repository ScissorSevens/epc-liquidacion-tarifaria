import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import ListaSuscriptores from '../../src/pantallas/ListaSuscriptores';
import { crearNavMock } from './__mocks__/nav';
import { getBootstrap } from '../../src/composition/get-bootstrap';

jest.mock('../../src/composition/get-bootstrap');
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

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
    render(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Ana García')).toBeTruthy();
    expect(await screen.findByText('Carlos López')).toBeTruthy();
    expect(await screen.findByText('María Torres')).toBeTruthy();
  });

  // SC-SYS-07: filtro por nombre reduce la lista
  it('SC-SYS-07: filtro por "ana" muestra solo Ana García', async () => {
    configurarBootstrap();
    render(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const input = screen.getByPlaceholderText('Buscar por código o nombre...');
    fireEvent.changeText(input, 'ana');
    expect(screen.getByText('Ana García')).toBeTruthy();
    expect(screen.queryByText('Carlos López')).toBeNull();
    expect(screen.queryByText('María Torres')).toBeNull();
  });

  // SC-SYS-08: búsqueda sin resultados muestra "Sin resultados"
  it('SC-SYS-08: búsqueda "xyz" muestra Sin resultados', async () => {
    configurarBootstrap();
    render(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const input = screen.getByPlaceholderText('Buscar por código o nombre...');
    fireEvent.changeText(input, 'xyz');
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });

  // SC-SYS-09: error en carga muestra REINTENTAR
  it('SC-SYS-09: error en carga muestra botón REINTENTAR', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('db error'));
    render(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('REINTENTAR')).toBeTruthy();
  });

  // SC-SYS-10: lista vacía muestra AGREGAR SUSCRIPTOR
  it('SC-SYS-10: lista vacía muestra botón AGREGAR SUSCRIPTOR', async () => {
    configurarBootstrap([]);
    render(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('AGREGAR SUSCRIPTOR')).toBeTruthy();
  });
});
