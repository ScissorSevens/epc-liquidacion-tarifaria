import React from 'react';
import { render, screen } from '@testing-library/react-native';
import RutaDeHoy from '../../src/pantallas/RutaDeHoy';
import { crearNavMock } from './__mocks__/nav';
import { getBootstrap } from '../../src/composition/get-bootstrap';

jest.mock('../../src/composition/get-bootstrap');
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

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

  // SC-SYS-11: suscriptor con lectura hoy muestra "Capturada hoy"
  it('SC-SYS-11: suscriptor con lectura hoy muestra Capturada hoy', async () => {
    configurarBootstrap();
    render(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Capturada hoy')).toBeTruthy();
  });

  // SC-SYS-12: suscriptores sin lectura muestran "Pendiente"
  it('SC-SYS-12: suscriptores sin lectura muestran Pendiente', async () => {
    configurarBootstrap();
    render(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Capturada hoy');
    const pendientes = screen.getAllByText('Pendiente');
    expect(pendientes.length).toBe(2);
  });

  // SC-SYS-13: cola con 4 items PENDIENTE muestra botón SINCRONIZAR con conteo
  it('SC-SYS-13: cola con 4 pendientes muestra SINCRONIZAR con conteo', async () => {
    const cola = [
      { id: 1, estado: 'PENDIENTE' },
      { id: 2, estado: 'PENDIENTE' },
      { id: 3, estado: 'PENDIENTE' },
      { id: 4, estado: 'PENDIENTE' },
    ];
    configurarBootstrap({ cola });
    render(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText(/SINCRONIZAR/)).toBeTruthy();
    expect(await screen.findByText(/4/)).toBeTruthy();
  });

  // SC-SYS-14: cola vacía — botón SINCRONIZAR NO aparece
  it('SC-SYS-14: cola vacía oculta botón SINCRONIZAR', async () => {
    configurarBootstrap({ cola: [] });
    render(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    expect(screen.queryByText(/SINCRONIZAR/)).toBeNull();
  });

  // SC-SYS-15: error en carga muestra REINTENTAR
  it('SC-SYS-15: error en carga muestra REINTENTAR', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('fallo de red'));
    render(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('REINTENTAR')).toBeTruthy();
  });

  // SC-SYS-16: 1 de 3 suscriptores con lectura → "1 / 3 capturadas"
  it('SC-SYS-16: muestra el progreso correcto 1 / 3 capturadas', async () => {
    configurarBootstrap();
    render(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('1 / 3 capturadas')).toBeTruthy();
  });
});
