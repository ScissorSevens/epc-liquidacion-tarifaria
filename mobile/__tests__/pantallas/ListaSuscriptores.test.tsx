import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { FlatList, ScrollView } from 'react-native';
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

  // SC-SYS-09: error en carga muestra Reintentar
  it('SC-SYS-09: error en carga muestra botón Reintentar', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('db error'));
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
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

  // ──────────────────────────────────────────────────────────────────────────
  // PER-02 — FlatList sin ScrollView contenedor (virtualización OK)
  // ──────────────────────────────────────────────────────────────────────────

  // T-FLAT-1: FlatList renderizada con data={filtrados}
  it('T-FLAT-1: renderiza FlatList con data igual a los suscriptores cargados', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const flatList = screen.UNSAFE_queryByType(FlatList as unknown as React.ComponentType<unknown>);
    expect(flatList).not.toBeNull();
    const data = (flatList as unknown as { props: { data: unknown[] } }).props.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);
  });

  // T-FLAT-2: ListHeaderComponent configurado (buscador arriba de la lista)
  it('T-FLAT-2: ListHeaderComponent está configurado (input de búsqueda arriba)', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const flatList = screen.UNSAFE_queryByType(FlatList as unknown as React.ComponentType<unknown>);
    expect(flatList).not.toBeNull();
    const props = (flatList as unknown as { props: { ListHeaderComponent: unknown } }).props;
    expect(props.ListHeaderComponent).toBeDefined();
  });

  // T-FLAT-3: ListFooterComponent configurado (FooterApp abajo)
  it('T-FLAT-3: ListFooterComponent está configurado', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const flatList = screen.UNSAFE_queryByType(FlatList as unknown as React.ComponentType<unknown>);
    expect(flatList).not.toBeNull();
    const props = (flatList as unknown as { props: { ListFooterComponent: unknown } }).props;
    expect(props.ListFooterComponent).toBeDefined();
  });

  // T-FLAT-4: keyExtractor extrae id_suscriptor (no el index)
  it('T-FLAT-4: keyExtractor extrae el id_suscriptor de cada suscriptor', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const flatList = screen.UNSAFE_queryByType(FlatList as unknown as React.ComponentType<unknown>);
    expect(flatList).not.toBeNull();
    const keyExtractor = (flatList as unknown as {
      props: { keyExtractor: (item: { id_suscriptor: number }) => string };
    }).props.keyExtractor;
    expect(typeof keyExtractor).toBe('function');
    expect(keyExtractor(SUSCRIPTORES_DEFECTO[0]!)).toBe('1');
    expect(keyExtractor(SUSCRIPTORES_DEFECTO[1]!)).toBe('2');
    expect(keyExtractor(SUSCRIPTORES_DEFECTO[2]!)).toBe('3');
  });

  // T-FLAT-5: NO hay ScrollView ANCESTRO de la FlatList (la virtualización
// requiere un ScrollView INTERNO a la FlatList — eso es correcto; el bug
// era tener un ScrollView PADRE que forzara render eager de todas las filas).
  it('T-FLAT-5: NO hay ScrollView ancestro de la FlatList (virtualización OK)', async () => {
    configurarBootstrap();
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    const flatList = screen.UNSAFE_queryByType(FlatList as unknown as React.ComponentType<unknown>) as
      | { _fiber: { return: { type?: unknown } | null } }
      | null;
    expect(flatList).not.toBeNull();
    // Walk up from FlatList to root. None of those ancestors should be a ScrollView.
    let cursor: { return: { type?: unknown; return?: unknown } | null } | null = flatList!._fiber;
    while (cursor) {
      const type = cursor.return?.type;
      expect(type).not.toBe(ScrollView);
      cursor = (cursor.return ?? null) as typeof cursor;
    }
  });

  // T-FLAT-6: lista vacía usa ListEmptyComponent
  it('T-FLAT-6: lista vacía tiene ListEmptyComponent configurado', async () => {
    configurarBootstrap([]);
    renderConProviders(<ListaSuscriptores navigation={nav as any} route={{} as any} />);
    const flatList = screen.UNSAFE_queryByType(FlatList as unknown as React.ComponentType<unknown>);
    expect(flatList).not.toBeNull();
    const props = (flatList as unknown as { props: { ListEmptyComponent: unknown } }).props;
    expect(props.ListEmptyComponent).toBeDefined();
  });
});
