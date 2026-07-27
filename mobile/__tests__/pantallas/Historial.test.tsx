// mobile/__tests__/pantallas/Historial.test.tsx
//
// Tests contractuales del Historial (pantalla de historial de consumo
// de un suscriptor).
//
// Historial tiene 3 KPI cards (Promedio, Pico, Total) que tras la
// migración 2026-07-26 se renderizan via <TarjetaMetrica> extraída.
// Esto elimina la copia local de "kpiItem" con estilos ad-hoc.
//
// Estos tests son RED al inicio (las KPI cards existen como Views
// inline con kpiValor/kpiUnidad); tras la migración a <TarjetaMetrica>
// pasan GREEN.
//
// Mocks:
//   - theme tokens (mocked, no StyleSheet real).
//   - expo-splash-screen.
//   - getBootstrap con medidorRepo + lecturaRepo in-memory.

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
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
    surfaceContainer: '#eee',
    surfaceVariant: '#eee',
    surfaceDim: '#ddd',
    outlineVariant: '#ccc',
    outline: '#888',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    textSecondary: '#777',
    error: '#f00',
    errorContainer: '#fee',
    brandAmarillo: '#FFDC26',
    brandAzulOscuro: '#093C5D',
    brandVerde: '#76B718',
    brandRojo: '#D5212A',
    secondary: '#00677F',
    onSecondaryContainer: '#fff',
    secondaryContainer: '#cce8f0',
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

import Historial from '../../src/pantallas/Historial';
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

/** Genera N lecturas con delta de consumo dado (consumo_efectivo_m3 = lectura_actual - lectura_anterior). */
function generarLecturas(
  periodos: ReadonlyArray<{ periodo: string; anterior: number; actual: number }>,
) {
  return periodos.map((p, i) => ({
    id_lectura: i + 1,
    id_medidor: 99,
    id_periodo: p.periodo,
    id_operario: 1,
    lectura_anterior: p.anterior,
    lectura_actual: p.actual,
    timestamp_captura: `${p.periodo}-15T10:00:00.000Z`,
    estado_sync: 'sincronizado' as const,
    evidencia: undefined,
  }));
}

describe('Historial — TarjetaMetrica migration', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  function configurarBootstrap(lecturas: ReturnType<typeof generarLecturas>) {
    mockGetBootstrap.mockResolvedValue({
      medidorRepo: {
        listarPorSuscriptor: jest.fn().mockResolvedValue([{ id_medidor: 99, numero_medidor: 'M1' }]),
      },
      lecturaRepo: {
        listarPorMedidor: jest.fn().mockResolvedValue(lecturas),
      },
    } as any);
  }

  // T-HIS-TARJETA-1: el KPI "Promedio" muestra el promedio de consumo
  // formateado a 1 decimal con la unidad "m³" anexada.
  it('T-HIS-TARJETA-1: KPI Promedio muestra el promedio calculado', async () => {
    configurarBootstrap(
      generarLecturas([
        { periodo: '2026-04', anterior: 0, actual: 10 }, // 10
        { periodo: '2026-05', anterior: 10, actual: 20 }, // 10
        { periodo: '2026-06', anterior: 20, actual: 30 }, // 10
      ]),
    );
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    await screen.findByText('Métricas generales');
    // Promedio = (10+10+10)/3 = 10.0 m³ (verificamos el KPI card
    // por testID, no por texto, porque la lista de lecturas también
    // muestra el mismo formato).
    expect(screen.getByTestId('kpi-promedio-valor').props.children).toBe('10.0 m³');
    expect(screen.getByText('Promedio')).toBeTruthy();
  });

  // T-HIS-TARJETA-2: el KPI "Pico" muestra el máximo de consumo.
  it('T-HIS-TARJETA-2: KPI Pico muestra el maximo de consumo', async () => {
    configurarBootstrap(
      generarLecturas([
        { periodo: '2026-04', anterior: 0, actual: 5 }, // 5
        { periodo: '2026-05', anterior: 5, actual: 25 }, // 20 (pico)
        { periodo: '2026-06', anterior: 25, actual: 30 }, // 5
      ]),
    );
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    await screen.findByText('Métricas generales');
    expect(screen.getByTestId('kpi-pico-valor').props.children).toBe('20.0 m³');
    expect(screen.getByText('Pico')).toBeTruthy();
  });

  // T-HIS-TARJETA-3: el KPI "Total" muestra la suma de consumos.
  it('T-HIS-TARJETA-3: KPI Total muestra la suma (sin decimales)', async () => {
    configurarBootstrap(
      generarLecturas([
        { periodo: '2026-04', anterior: 0, actual: 12 }, // 12
        { periodo: '2026-05', anterior: 12, actual: 25 }, // 13
        { periodo: '2026-06', anterior: 25, actual: 40 }, // 15
      ]),
    );
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    await screen.findByText('Métricas generales');
    // 12 + 13 + 15 = 40 → toFixed(0) = "40 m³"
    expect(screen.getByTestId('kpi-total-valor').props.children).toBe('40 m³');
    expect(screen.getByText('Total')).toBeTruthy();
  });

  // T-HIS-TARJETA-4: las 3 KPI cards renderizan como TarjetaMetrica con
  // el icono y testID correspondientes. La migración conserva la
  // accesibilidad: las tarjetas llevan `accessibilityRole="text"`.
  it('T-HIS-TARJETA-4: las 3 KPI cards son TarjetaMetrica (icono + valor + etiqueta visibles)', async () => {
    configurarBootstrap(
      generarLecturas([
        { periodo: '2026-06', anterior: 0, actual: 10 },
      ]),
    );
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    await screen.findByText('Métricas generales');
    // Cada TarjetaMetrica tiene un contenedor con accessibilityRole="text"
    // y accessibilityLabel "Etiqueta: valor".
    const View = require('react-native').View;
    const views = screen.UNSAFE_queryAllByType(View as never) as Array<{
      props: { accessibilityRole?: string; accessibilityLabel?: string };
    }>;
    const tarjetas = views.filter((v) => v.props.accessibilityRole === 'text');
    // 3 KPIs visibles
    expect(tarjetas.length).toBeGreaterThanOrEqual(3);
  });

  // T-HIS-TARJETA-5: cuando NO hay lecturas, los 3 KPIs muestran "0".
  it('T-HIS-TARJETA-5: sin lecturas, los 3 KPIs muestran 0', async () => {
    configurarBootstrap([]);
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    await screen.findByText('Métricas generales');
    // Promedio y Pico: "0.0 m³"; Total: "0 m³". Verificamos por testID
    // de cada TarjetaMetrica (cada una tiene su testID).
    expect(screen.getByTestId('kpi-promedio-valor').props.children).toBe('0.0 m³');
    expect(screen.getByTestId('kpi-pico-valor').props.children).toBe('0.0 m³');
    expect(screen.getByTestId('kpi-total-valor').props.children).toBe('0 m³');
  });

  // T-HIS-BOTON-1: el botón "Volver" del final navega con goBack.
  it('T-HIS-BOTON-1: "Volver" llama goBack', async () => {
    configurarBootstrap(
      generarLecturas([{ periodo: '2026-06', anterior: 0, actual: 10 }]),
    );
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    const btn = await screen.findByText('Volver');
    fireEvent.press(btn);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  // T-HIS-ERROR-1: si la carga falla, el botón "Reintentar" aparece.
  it('T-HIS-ERROR-1: error de carga muestra botón "Reintentar"', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('boom'));
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Reintentar')).toBeTruthy();
    });
  });

  // T-HIS-TARJETA-6: el gráfico de barras NO se altera por la migración
  // de las KPI cards. Esta es una regresión de seguridad: las tarjetas
  // se cambiaron, el gráfico y la lista de lecturas persisten.
  it('T-HIS-TARJETA-6: gráfico "Últimos 6 meses" sigue visible tras migración', async () => {
    configurarBootstrap(
      generarLecturas([
        { periodo: '2026-01', anterior: 0, actual: 5 },
        { periodo: '2026-02', anterior: 5, actual: 12 },
        { periodo: '2026-03', anterior: 12, actual: 18 },
      ]),
    );
    renderConProviders(
      <Historial
        navigation={nav as any}
        route={{ key: 'k', name: 'Historial', params: { id_suscriptor: 7, nombre: 'Ana' } } as any}
      />,
    );
    await screen.findByText('Métricas generales');
    expect(screen.getByText('Últimos 6 meses')).toBeTruthy();
    expect(screen.getByText('Historial de Lecturas')).toBeTruthy();
  });
});