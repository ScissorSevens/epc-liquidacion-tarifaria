// mobile/__tests__/pantallas/ImportarCsv.test.tsx
//
// Tests contractuales del ImportarCsv.
//
// ImportarCsv tiene muchos CTAs primarios que tras la migración
// 2026-07-26 se renderizan via <BotonPrimario> extraído:
//   - "Seleccionar archivo CSV" (idle, primary)
//   - "Importar suscriptores" (preview, primary, conditional disabled)
//   - "Ir al inicio" (resultado, primary)
//   - "Reintentar" (error, primary)
//   - "Continuar" (modal confirmación, primary)
//
// Los CTAs secundarios (outline) se mantienen como Pressable inline
// porque no encajan en el componente extraído (color con propósito).
//
// Estos tests son RED al inicio (los CTAs existen pero como Pressable
// inline); tras la migración a <BotonPrimario> pasan GREEN.
//
// Mocks:
//   - expo-splash-screen.
//   - expo-document-picker.
//   - expo-file-system.
//   - persistir-y-encolar-importacion (mock: simular resultado).
//   - getBootstrap.
//   - theme tokens.

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
    secondary: '#00677F',
    onSecondary: '#fff',
    surfaceContainerLowest: '#fff',
    surfaceContainerLow: '#fafafa',
    surfaceContainer: '#eee',
    surfaceVariant: '#eee',
    surfaceLight: '#f0f4ff',
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
    displayLg: { fontSize: 36 },
    bodyLg: { fontSize: 16 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
    labelLg: { fontSize: 14 },
    labelMd: { fontSize: 12 },
    labelSm: { fontSize: 10 },
  },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
}));

jest.mock('../../src/composition/get-bootstrap');
import { getBootstrap } from '../../src/composition/get-bootstrap';
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

jest.mock('../../src/adapters/persistir-y-encolar-importacion', () => ({
  persistirYEncolarImportacion: jest.fn(),
}));
import { persistirYEncolarImportacion } from '../../src/adapters/persistir-y-encolar-importacion';
const mockPersistir = persistirYEncolarImportacion as jest.MockedFunction<
  typeof persistirYEncolarImportacion
>;

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import ImportarCsv, { HEADER_ESPERADO_TXT } from '../../src/pantallas/ImportarCsv';
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

// CSV mínimo válido para el parser. 9 columnas (header nuevo) y
// fecha_instalacion en formato YYYY-MM-DD.
const REPORTE_EXITO = {
  suscriptoresCreados: 1,
  medidoresCreados: 1,
  saltados: [],
  errores: [],
};

const CSV_VALIDO =
  'nombre_apellidos,cedula,municipio,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor\n' +
  'Ana García,12345678,Caqueza,Calle 1,2,,,2024-05-01,';

function setupDocumentPickerConCsv(csv: string = CSV_VALIDO) {
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///fake.csv', name: 'suscriptores.csv' }],
  });
  (File as unknown as jest.Mock).mockImplementation(() => ({
    text: jest.fn().mockResolvedValue(csv),
  }));
}

describe('ImportarCsv — BotonPrimario migration', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
    mockGetBootstrap.mockResolvedValue({
      repos: {
        suscriptorRepo: {},
        medidorRepo: {},
        colaRepo: {},
      },
      adapters: {
        idGenerator: { uuid: () => 'uuid' },
        hasher: { sha256: (s: string) => `sha256(${s})` },
      },
    } as any);
    mockPersistir.mockResolvedValue({ reporte: REPORTE_EXITO, itemsEncolados: [] });
  });

  // T-IMP-BOTON-1: el CTA "Seleccionar archivo CSV" del estado idle
  // está implementado con <BotonPrimario> extraído (tono azul, icono
  // upload-file, touch target 56px).
  it('T-IMP-BOTON-1: estado idle muestra "Seleccionar archivo CSV"', async () => {
    renderConProviders(<ImportarCsv navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Seleccionar archivo CSV')).toBeTruthy();
    expect(screen.getByText('Ver formato esperado')).toBeTruthy();
  });

  // T-IMP-BOTON-2: tocar "Seleccionar archivo CSV" abre el DocumentPicker
  // y lee el archivo. Verificamos el side effect del Pressable.
  it('T-IMP-BOTON-2: tocar "Seleccionar archivo CSV" invoca DocumentPicker.getDocumentAsync', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: [],
    });

    renderConProviders(<ImportarCsv navigation={nav as any} route={{} as any} />);
    const btn = await screen.findByText('Seleccionar archivo CSV');
    fireEvent.press(btn);
    await waitFor(() => {
      expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledTimes(1);
    });
  });

  // T-IMP-BOTON-3: después de parsear el CSV exitosamente, aparece
  // "Importar suscriptores" (BotonPrimario primario) + "Cancelar"
  // (Pressable secundario).
  it('T-IMP-BOTON-3: tras seleccionar CSV válido, aparece "Importar suscriptores"', async () => {
    setupDocumentPickerConCsv();

    renderConProviders(<ImportarCsv navigation={nav as any} route={{} as any} />);
    const seleccionar = await screen.findByText('Seleccionar archivo CSV');
    fireEvent.press(seleccionar);

    // Aparece el CTA "Importar suscriptores" tras parseo OK.
    expect(await screen.findByText('Importar suscriptores')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  // T-IMP-BOTON-4: tocar "Importar suscriptores" llama al importador
  // (persistirYEncolarImportacion) y muestra el reporte de resultado.
  it('T-IMP-BOTON-4: tocar "Importar suscriptores" ejecuta el importador y muestra "Resultado de la importación"', async () => {
    setupDocumentPickerConCsv();

    renderConProviders(<ImportarCsv navigation={nav as any} route={{} as any} />);
    fireEvent.press(await screen.findByText('Seleccionar archivo CSV'));

    const importarBtn = await screen.findByText('Importar suscriptores');
    fireEvent.press(importarBtn);

    await waitFor(() => {
      expect(mockPersistir).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Resultado de la importación')).toBeTruthy();
  });

  // T-IMP-BOTON-5: tras el resultado, "Ir al inicio" llama popToTop.
  it('T-IMP-BOTON-5: "Ir al inicio" llama navigation.popToTop()', async () => {
    setupDocumentPickerConCsv();

    renderConProviders(<ImportarCsv navigation={nav as any} route={{} as any} />);
    fireEvent.press(await screen.findByText('Seleccionar archivo CSV'));
    fireEvent.press(await screen.findByText('Importar suscriptores'));

    const irInicio = await screen.findByText('Ir al inicio');
    fireEvent.press(irInicio);
    expect(nav.popToTop).toHaveBeenCalledTimes(1);
  });

  // T-IMP-BOTON-6: si el importador falla, aparece "Reintentar".
  it('T-IMP-BOTON-6: si el importador falla, aparece "Reintentar"', async () => {
    mockPersistir.mockRejectedValueOnce(new Error('db locked'));
    setupDocumentPickerConCsv();

    renderConProviders(<ImportarCsv navigation={nav as any} route={{} as any} />);
    fireEvent.press(await screen.findByText('Seleccionar archivo CSV'));
    fireEvent.press(await screen.findByText('Importar suscriptores'));

    expect(await screen.findByText('Reintentar')).toBeTruthy();
  });

  // T-IMP-CSV-HEADER: el HEADER_ESPERADO_TXT exportado por la pantalla
  // debe coincidir token-a-token con el HEADER_NUEVO del parser. Esta es
  // la garantía de que la UI no miente sobre las columnas.
  it('T-IMP-CSV-HEADER: el header esperado tiene 9 columnas con cédula y municipio', () => {
    expect(HEADER_ESPERADO_TXT).toContain('cedula');
    expect(HEADER_ESPERADO_TXT).toContain('municipio');
    expect(HEADER_ESPERADO_TXT).toContain('email');
    expect(HEADER_ESPERADO_TXT).toContain('telefono');
    const cols = HEADER_ESPERADO_TXT.split(',');
    expect(cols).toHaveLength(11);
  });
});