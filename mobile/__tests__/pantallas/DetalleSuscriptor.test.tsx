// mobile/__tests__/pantallas/DetalleSuscriptor.test.tsx
//
// Tests contractuales del DetalleSuscriptor.
//
// DetalleSuscriptor es la pantalla read-only de un suscriptor + sus
// medidores asociados. Re-renderiza tres CTAs primarios via <BotonPrimario>
// extraído (migración 2026-07-26 desde Pressables inline):
//
//   - "Volver" (estado vacio "Suscriptor no encontrado")
//   - "Editar suscriptor" (bottom bar)
//   - "Capturar lectura" (por medidor, dentro del card de medidores)
//
// Estos tests son RED al inicio (las CTAs existen pero con Pressable
// inline); tras la migración a <BotonPrimario> pasan GREEN sin tocar
// la lógica de navegación — el componente extraído conserva el
// accesibilidadRole="button" + testID estable.
//
// Mocks:
//   - expo-splash-screen.
//   - AsyncStorage.
//   - theme tokens.
//   - getBootstrap (repos in-memory al test).

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 } },
  COLORS: {
    background: '#fff',
    primary: '#093C5D',
    onPrimary: '#fff',
    primaryContainer: '#3596C8',
    surfaceContainerLowest: '#fff',
    surfaceContainerLow: '#fafafa',
    surfaceVariant: '#eee',
    outlineVariant: '#ccc',
    outline: '#888',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    textSecondary: '#777',
    error: '#f00',
    errorContainer: '#fee',
    onErrorContainer: '#900',
    brandAmarillo: '#FFDC26',
    brandAzulOscuro: '#093C5D',
    brandVerde: '#76B718',
    brandRojo: '#D5212A',
  },
  RADIUS: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999, default: 8, card: 16 },
  SHADOWS: { card: {}, float: {} },
  SPACING: {
    margin: 16, lg: 24, md: 16, sm: 8, xs: 4, xl: 32, xxl: 48, gutter: 12,
  },
  TYPOGRAPHY: {
    headlineLg: { fontSize: 28 },
    headlineMd: { fontSize: 24 },
    headlineSm: { fontSize: 20 },
    bodyLg: { fontSize: 16 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
    labelLg: { fontSize: 14 },
    labelMd: { fontSize: 12 },
    labelSm: { fontSize: 10 },
  },
}));

jest.mock('../../src/composition/get-bootstrap');
import { getBootstrap } from '../../src/composition/get-bootstrap';
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

import DetalleSuscriptor from '../../src/pantallas/DetalleSuscriptor';
import { crearNavMock } from './__mocks__/nav';

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

const SUSCRIPTOR_BASE = {
  id_suscriptor: 7,
  codigo: 'S007',
  nombre_apellidos: 'Ana García',
  cedula: '12345678',
  direccion: 'Calle 7',
  municipio: 'Caqueza',
  estrato: 2,
  estado: 'activo' as const,
  sector: null,
  matricula_inmobiliaria: null,
  numero_catastral: null,
  aplica_subsidio: true,
  created_at: '2026-01-01T00:00:00.000Z',
  contacto: null,
};

const MEDIDOR_BASE = {
  id_medidor: 99,
  id_suscriptor: 7,
  numero_medidor: 'M-0099',
  fecha_instalacion: '2024-05-01',
  estado: 'activo' as const,
  observaciones: '',
};

function configurarBootstrap({
  suscriptor = SUSCRIPTOR_BASE,
  medidores = [MEDIDOR_BASE],
} = {}) {
  mockGetBootstrap.mockResolvedValue({
    suscriptorRepo: {
      buscarPorId: jest.fn().mockResolvedValue(suscriptor),
      toggleSubsidio: jest.fn(),
    },
    medidorRepo: {
      listarPorSuscriptor: jest.fn().mockResolvedValue(medidores),
    },
    lecturaRepo: {
      listarPorMedidor: jest.fn().mockResolvedValue([]),
    },
  } as any);
}

describe('DetalleSuscriptor — BotonPrimario migration', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  // T-DET-BOTON-1: el botón "Editar suscriptor" del bottom bar llama
  // navigation.navigate('EditarSuscriptor').
  it('T-DET-BOTON-1: "Editar suscriptor" navega a EditarSuscriptor', async () => {
    configurarBootstrap();
    renderConProviders(
      <DetalleSuscriptor
        navigation={nav as any}
        route={{ key: 'k', name: 'DetalleSuscriptor', params: { id_suscriptor: 7 } } as any}
      />,
    );
    const btn = await screen.findByText('Editar suscriptor');
    fireEvent.press(btn);
    expect(nav.navigate).toHaveBeenCalledWith('EditarSuscriptor', {
      suscriptor: expect.objectContaining({ id_suscriptor: 7 }),
    });
  });

  // T-DET-BOTON-2: "Capturar lectura" navega con id_medidor + id_suscriptor.
  it('T-DET-BOTON-2: "Capturar lectura" navega a CapturarLectura', async () => {
    configurarBootstrap();
    renderConProviders(
      <DetalleSuscriptor
        navigation={nav as any}
        route={{ key: 'k', name: 'DetalleSuscriptor', params: { id_suscriptor: 7 } } as any}
      />,
    );
    const btn = await screen.findByText('Capturar lectura');
    fireEvent.press(btn);
    expect(nav.navigate).toHaveBeenCalledWith('CapturarLectura', {
      id_medidor: 99,
      id_suscriptor: 7,
    });
  });

  // T-DET-BOTON-3: cuando el suscriptor es null, aparece "Volver" en el
  // estado vacío Y en el bottom bar. Ambos llaman goBack.
  it('T-DET-BOTON-3: estado vacío "Suscriptor no encontrado" muestra "Volver" (presionar llama goBack)', async () => {
    configurarBootstrap({ suscriptor: null as never });
    renderConProviders(
      <DetalleSuscriptor
        navigation={nav as any}
        route={{ key: 'k', name: 'DetalleSuscriptor', params: { id_suscriptor: 999 } } as any}
      />,
    );
    const volverBtns = await screen.findAllByText('Volver');
    expect(volverBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.press(volverBtns[0]!);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  // T-DET-BOTON-4: el botón "Volver" del bottom bar llama goBack cuando
  // hay suscriptor cargado.
  it('T-DET-BOTON-4: "Volver" del bottom bar llama goBack (hay suscriptor)', async () => {
    configurarBootstrap();
    renderConProviders(
      <DetalleSuscriptor
        navigation={nav as any}
        route={{ key: 'k', name: 'DetalleSuscriptor', params: { id_suscriptor: 7 } } as any}
      />,
    );
    await screen.findByText('Editar suscriptor'); // espera carga
    const volverBtns = screen.getAllByText('Volver');
    expect(volverBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.press(volverBtns[0]!);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  // T-DET-BOTON-5: "Ver historial completo" por medidor navega a Historial.
  it('T-DET-BOTON-5: "Ver historial completo" navega a Historial', async () => {
    configurarBootstrap();
    renderConProviders(
      <DetalleSuscriptor
        navigation={nav as any}
        route={{ key: 'k', name: 'DetalleSuscriptor', params: { id_suscriptor: 7 } } as any}
      />,
    );
    const btn = await screen.findByText('Ver historial completo');
    fireEvent.press(btn);
    expect(nav.navigate).toHaveBeenCalledWith('Historial', {
      id_suscriptor: 7,
      nombre: 'Ana García',
    });
  });

  // T-DET-ERROR-1: si la carga falla, el snack inline muestra "Reintentar".
  it('T-DET-ERROR-1: error de carga muestra botón "Reintentar"', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('boom'));
    renderConProviders(
      <DetalleSuscriptor
        navigation={nav as any}
        route={{ key: 'k', name: 'DetalleSuscriptor', params: { id_suscriptor: 7 } } as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Reintentar')).toBeTruthy();
    });
  });

  // T-DET-EMPTY-1: con 0 medidores, "Capturar lectura" NO aparece (verifica
  // que el componente renderiza el texto "Sin medidores asociados").
  it('T-DET-EMPTY-1: con 0 medidores, NO hay botón "Capturar lectura"', async () => {
    configurarBootstrap({ medidores: [] });
    renderConProviders(
      <DetalleSuscriptor
        navigation={nav as any}
        route={{ key: 'k', name: 'DetalleSuscriptor', params: { id_suscriptor: 7 } } as any}
      />,
    );
    await screen.findByText('Editar suscriptor');
    expect(screen.queryByText('Capturar lectura')).toBeNull();
    expect(screen.getByText('Sin medidores asociados')).toBeTruthy();
  });
});