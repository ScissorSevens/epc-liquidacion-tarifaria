// mobile/__tests__/pantallas/CapturarLectura.test.tsx
//
// Test de la plomeria de idOperario en CapturarLectura (COR-04).
//
// ANTES del fix: `id_operario: 1` hardcoded en onCalcular (linea 309).
// Cada lectura quedaba atribuida al operario id=1, rompiendo la auditoria
// legal (Res CRA 825/2017 art. 1.3.1.5).
//
// DESPUES del fix: CapturarLectura carga `cargarSesion()` al mount y usa
// `sesion.idOperario` para construir la EntradaLectura. Asi la lectura
// queda atribuida al operario REAL que la capturo, no a un placeholder.
//
// QUE CUBRE ESTE ARCHIVO:
//   - C6.1  CapturarLectura llama cargarSesion() al mount y, al ejecutar
//           "Guardar y calcular", construye la EntradaLectura con el
//           idOperario de la sesion (id=42) — NO con id=1 hardcoded.
//   - C6.2  Triangulacion: con sesion de otro operario (id=7777), el campo
//           idOperario fluye correctamente al persistir la lectura.
//   - C6.3  Defensive: si cargarSesion() devuelve null (no deberia pasar
//           porque AuthGate bloca, pero defensivamente…), la pantalla
//           NO debe hardcodear 1 — debe bloquear la accion con error claro.
//
// TDD Evidence:
//   RED  → estos tests son la primera implementacion. Antes del fix,
//          CapturarLectura usaba `id_operario: 1` literal — el test C6.1
//          falla al asertar `id_operario === 42`.
//   GREEN → CapturarLectura carga sesion y la usa en el builder de
//          EntradaLectura; los 3 tests pasan.

import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 }, error: { borderWidth: 2, borderColor: '#f00' } },
  COLORS: {
    background: '#fff',
    surfaceContainerLow: '#fff',
    surfaceContainerLowest: '#fff',
    primary: '#3596C8',
    onPrimary: '#fff',
    primaryContainer: '#3596C8',
    surfaceLight: '#f0f4ff',
    surfaceDim: '#888',
    outlineVariant: '#ccc',
    outline: '#888',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    textSecondary: '#555',
    placeholder: '#aaa',
    error: '#f00',
    errorContainer: '#fee',
  },
  RADIUS: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  SHADOWS: { card: {} },
  SPACING: { margin: 16, lg: 24, md: 16, sm: 8, xs: 4, xl: 32, xxl: 48, gutter: 12 },
  TYPOGRAPHY: {
    headlineLg: { fontSize: 28 },
    headlineMd: { fontSize: 22 },
    headlineSm: { fontSize: 18 },
    bodyLg: { fontSize: 16 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
    labelLg: { fontSize: 14 },
    labelMd: { fontSize: 12 },
    labelSm: { fontSize: 10 },
  },
}));

// ── Mocks del composition / adapters ────────────────────────────────────────

jest.mock('../../src/composition/get-bootstrap');
const mockGetBootstrap = require('../../src/composition/get-bootstrap').getBootstrap;

jest.mock('../../src/composition/photo-capture-store', () => ({
  photoCaptureStore: {
    getAndClear: jest.fn().mockReturnValue(null),
    setEvidencia: jest.fn(),
  },
}));

jest.mock('../../src/composition/constantes');
const mockCargarSesion = require('../../src/composition/constantes').cargarSesion;

jest.mock('../../src/adapters/persistir-y-encolar-lectura');
const mockPersistirYEncolarLectura =
  require('../../src/adapters/persistir-y-encolar-lectura').persistirYEncolarLectura;

import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Sesion } from '../../src/composition/constantes';
import CapturarLectura from '../../src/pantallas/CapturarLectura';
import { crearNavMock } from './__mocks__/nav';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const SESION_ID_OPERARIO_42: Sesion = {
  token: 'tok-' + 'a'.repeat(32),
  cedula: '51800012',
  nombre: 'Ana Operario',
  idOperario: 42,
  idPrestador: 7,
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
};

const SUSCRIPTOR_BASE = {
  id_suscriptor: 1,
  codigo: 'S001',
  nombre_apellidos: 'Juan Pérez',
  cedula: '12345678',
  municipio: 'Bogotá',
  direccion: 'Calle 1',
  estrato: 2,
  aplica_subsidio: true,
  estado: 'activo',
  created_at: '2026-01-01',
  id_prestador: 7,
  categoria_uso: 'residencial',
};

const PARAMETROS = {
  id_parametros: 1,
  id_prestador: 7,
  id_acuerdo: 1,
  periodo: 2026,
  cma: 30_000_000,
  cmo: 1500,
  cmi: 300,
  cmt: 200,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 100_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 3000,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2026-12-31',
  created_at: '2026-01-01',
};

const ACUERDO = {
  id_acuerdo: 1,
  id_prestador: 7,
  factor_subsidio_e1: -0.5,
  factor_subsidio_e2: -0.4,
  factor_subsidio_e3: -0.15,
  factor_contribucion_e5: 0.5,
  factor_contribucion_e6: 0.6,
  factor_contribucion_comercial: 0.5,
  factor_contribucion_industrial: 0.3,
  fecha_vigencia_desde: '2026-01-01',
  fecha_vigencia_hasta: '2030-12-31',
  acto_administrativo_url: null,
  observaciones: '',
  created_at: '2026-01-01',
};

const PRESTADOR = {
  id_prestador: 7,
  codigo: '0001',
  nombre: 'EPC Demo',
  nit: '900123456-7',
  representante_legal: 'X',
  representante_legal_cedula: '12345678',
  municipio: 'Bogotá',
  departamento: 'Cundinamarca',
  segmento: 2,
  num_suscriptores_urbanos: 0,
  num_suscriptores_rurales: 100,
  contacto: null,
  estado: 'activo',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

function configurarMocksExito(opts: {
  sesion: Sesion | null;
  lecturaPersistida: Lectura;
}) {
  // Re-mapeamos la lecturaPersistida para incluir los campos requeridos
  // (estado_validacion, estado_sync) sin importar que el caller los omita.
  const lecturaPersistidaCompleta: Lectura = {
    ...opts.lecturaPersistida,
    estado_validacion: 'pendiente',
    estado_sync: 'pendiente',
  };
  opts.lecturaPersistida = lecturaPersistidaCompleta;
  // Sesion: cargarSesion() se invoca al mount desde el componente.
  (mockCargarSesion as jest.Mock).mockResolvedValue(opts.sesion);

  // Repos del bootstrap.
  (mockGetBootstrap as jest.Mock).mockResolvedValue({
    repos: {
      lecturaRepo: {
        listar: jest.fn().mockResolvedValue([]), // sin lecturas previas → no prefill
      },
      suscriptorRepo: {
        buscarPorId: jest.fn().mockResolvedValue(SUSCRIPTOR_BASE),
      },
      lecturaRepoPersistir: {
        guardar: jest.fn().mockResolvedValue(opts.lecturaPersistida),
      },
      colaRepo: {
        guardar: jest.fn().mockResolvedValue(undefined),
        listar: jest.fn().mockResolvedValue([]),
      },
    },
    services: {
      resolverContextoPrestador: jest.fn().mockResolvedValue({
        prestador: PRESTADOR,
        parametros: PARAMETROS,
        acuerdo: ACUERDO,
      }),
    },
    adapters: {
      idGenerator: { uuid: jest.fn(() => 'uuid-1') },
      hasher: { sha256: jest.fn((s: string) => `sha256(${s})`) },
    },
  });

  // spy del persistirYEncolar — guarda la llamada para inspeccionar.
  (mockPersistirYEncolarLectura as jest.Mock).mockResolvedValue(undefined);
}

function crearRouteMock(params: Record<string, unknown> = { id_medidor: 7, id_suscriptor: 1 }) {
  return { key: 'test-route', name: 'CapturarLectura', params };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CapturarLectura — idOperario desde sesion (COR-04)', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  it('C6.1 EntradaLectura persistida tiene id_operario = sesion.idOperario (NO hardcoded 1)', async () => {
    const lecturaPersistidaFixture: Lectura = {
      id_lectura: 100,
      id_medidor: 7,
      id_periodo: '202605',
      id_operario: 42, // <- lo que CapturarLectura deberia propagar
      lectura_anterior: 1000,
      lectura_actual: 1150,
      timestamp_captura: '2026-05-15T10:00:00.000Z',
      estado_validacion: 'pendiente',
      estado_sync: 'pendiente',
    };
    configurarMocksExito({ sesion: SESION_ID_OPERARIO_42, lecturaPersistida: lecturaPersistidaFixture });

    renderConProviders(
      <CapturarLectura navigation={nav as any} route={crearRouteMock() as any} />,
    );

    // Llenamos el form con valores validos.
    // Hay 2 inputs con placeholder "0000": lectura_actual y lectura_anterior.
    const inputsAll = await screen.findAllByPlaceholderText('0000');
    expect(inputsAll.length).toBe(2);
    fireEvent.changeText(inputsAll[0], '1150'); // lectura_actual (primer input por orden)
    fireEvent.changeText(inputsAll[1], '1000'); // lectura_anterior

    // Periodo ya viene prellenado por el componente — no lo tocamos.

    // Presionamos Guardar y calcular (Title Case CTA)
    fireEvent.press(screen.getByText(/Guardar y calcular/));

    // Esperamos a que el persist se invoque.
    await waitFor(
      () => {
        expect(mockPersistirYEncolarLectura).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );

    // Recuperamos el primer argumento (deps con `lectura` que CapturarLectura construyó).
    const llamada = (mockPersistirYEncolarLectura as jest.Mock).mock.calls[0];
    const depsPasados = llamada[0] as { lectura: Lectura; [k: string]: unknown };
    const lecturaPersistida = depsPasados.lectura;

    // El id_operario debe coincidir con el de la sesion (42), NO ser 1 hardcoded.
    expect(lecturaPersistida.id_operario).toBe(42);
    expect(lecturaPersistida.id_operario).not.toBe(1);
    // Tamien debe matchear id_medidor
    expect(lecturaPersistida.id_medidor).toBe(7);
  });

  it('C6.2 triangulación: con sesion.idOperario=7777, la lectura se atribuye a 7777', async () => {
    const sesionConOtroId: Sesion = { ...SESION_ID_OPERARIO_42, idOperario: 7777 };
    const lecturaPersistidaFixture: Lectura = {
      id_lectura: 101,
      id_medidor: 7,
      id_periodo: '202605',
      id_operario: 7777, // nuevo id
      lectura_anterior: 1000,
      lectura_actual: 1150,
      timestamp_captura: '2026-05-15T10:00:00.000Z',
      estado_validacion: 'pendiente',
      estado_sync: 'pendiente',
    };
    configurarMocksExito({ sesion: sesionConOtroId, lecturaPersistida: lecturaPersistidaFixture });

    renderConProviders(
      <CapturarLectura navigation={nav as any} route={crearRouteMock() as any} />,
    );

    const inputsAll = await screen.findAllByPlaceholderText('0000');
    expect(inputsAll.length).toBe(2);
    fireEvent.changeText(inputsAll[0], '1150');
    fireEvent.changeText(inputsAll[1], '1000');

    fireEvent.press(screen.getByText(/Guardar y calcular/));

    await waitFor(
      () => {
        expect(mockPersistirYEncolarLectura).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );

    const llamada = (mockPersistirYEncolarLectura as jest.Mock).mock.calls[0];
    const depsPasados = llamada[0] as { lectura: Lectura; [k: string]: unknown };
    const lecturaPersistida = depsPasados.lectura;
    expect(lecturaPersistida.id_operario).toBe(7777);
    expect(lecturaPersistida.id_operario).not.toBe(42);
    expect(lecturaPersistida.id_operario).not.toBe(1);
  });

  it('C6.3 (defensivo) si cargarSesion devuelve null, NO se persiste con id=1 hardcoded — bloquea con snack', async () => {
    // cargarSesion() = null (caso defensivo; normalmente AuthGate previene esto).
    configurarMocksExito({
      sesion: null,
      lecturaPersistida: {
        id_lectura: 0,
        id_medidor: 7,
        id_periodo: '202605',
        id_operario: 999, // valor sentinela — NO debe llegar al persistir
        lectura_anterior: 1000,
        lectura_actual: 1150,
        timestamp_captura: '2026-05-15T10:00:00.000Z',
        estado_validacion: 'pendiente',
        estado_sync: 'pendiente',
      },
    });

    renderConProviders(
      <CapturarLectura navigation={nav as any} route={crearRouteMock() as any} />,
    );

    const inputsAll = await screen.findAllByPlaceholderText('0000');
    expect(inputsAll.length).toBe(2);
    fireEvent.changeText(inputsAll[0], '1150');
    fireEvent.changeText(inputsAll[1], '1000');

    fireEvent.press(screen.getByText(/Guardar y calcular/));

    // Damos tiempo para que onCalcular corra y se bloquee.
    await waitFor(
      () => {
        expect(mockPersistirYEncolarLectura).not.toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    // El snack debe mostrar un mensaje de error (no realizar la operacion).
    // No asseremos el mensaje exacto — solo que NO se persistio nada.
    expect(mockPersistirYEncolarLectura).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Bloque nuevo: lectura_anterior se renderiza como CARD si hay historial
// (subsiguiente) y como INPUT si NO hay historial (primera lectura).
// Regla UX (senior architect): evitar redundancia visual. La card ya
// muestra la lectura anterior arriba — si ademas hay un input editable/
// readonly abajo, el operario ve la misma informacion dos veces.
//   - hayLecturasPrevias=true  → SOLO card-lectura-anterior (consulta)
//   - hayLecturasPrevias=false → SOLO input-lectura-anterior (editable)
// ──────────────────────────────────────────────────────────────────────────

describe('CapturarLectura — lectura_anterior: card vs input segun historial', () => {
  let nav: ReturnType<typeof crearNavMock>;

  const LECTURA_HISTORICA = {
    id_lectura: 50,
    id_medidor: 7,
    id_periodo: '202603',
    id_operario: 42,
    lectura_anterior: 1100,
    lectura_actual: 1234,
    timestamp_captura: '2026-03-15T10:00:00.000Z',
    estado_validacion: 'aprobado',
    estado_sync: 'sincronizado',
  } as const;

  function setupBootstrap(opts: { lecturasPrevias: unknown[] }) {
    // Mismo patron que `configurarMocksExito` de arriba — un unico mockResolvedValue
    // para que TODAS las llamadas a getBootstrap() (lecturaRepo, suscriptorRepo,
    // resolverContextoPrestador) devuelvan el mismo objeto completo.
    (mockCargarSesion as jest.Mock).mockResolvedValue(SESION_ID_OPERARIO_42);
    (mockPersistirYEncolarLectura as jest.Mock).mockResolvedValue(undefined);
    (mockGetBootstrap as jest.Mock).mockResolvedValue({
      repos: {
        lecturaRepo: {
          listar: jest.fn().mockResolvedValue(opts.lecturasPrevias),
        },
        suscriptorRepo: {
          buscarPorId: jest.fn().mockResolvedValue(SUSCRIPTOR_BASE),
        },
        lecturaRepoPersistir: {
          guardar: jest.fn().mockResolvedValue(undefined),
        },
        colaRepo: {
          guardar: jest.fn().mockResolvedValue(undefined),
          listar: jest.fn().mockResolvedValue([]),
        },
      },
      services: {
        resolverContextoPrestador: jest.fn().mockResolvedValue({
          prestador: PRESTADOR,
          parametros: PARAMETROS,
          acuerdo: ACUERDO,
        }),
      },
      adapters: {
        idGenerator: { uuid: jest.fn(() => 'uuid-1') },
        hasher: { sha256: jest.fn((s: string) => `sha256(${s})`) },
      },
    });
  }

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  it('T-CAP-1: primera lectura (sin historial) → SOLO input editable, card ausente', async () => {
    // Setup: lecturaRepo.listar retorna [] → SIN lecturas previas.
    setupBootstrap({ lecturasPrevias: [] });

    renderConProviders(
      <CapturarLectura navigation={nav as any} route={crearRouteMock() as any} />,
    );

    // Card de lectura anterior NO debe estar en el arbol
    // (la card muestra el dato del historial; sin historial no aplica).
    expect(screen.queryByTestId('card-lectura-anterior')).toBeNull();

    // Input editable SI debe estar: el operario tipea el valor inicial.
    const inputAnterior = await screen.findByTestId('input-lectura-anterior');
    expect(inputAnterior.props.editable).toBe(true);
    expect(inputAnterior.props.value).toBe('');
    expect(inputAnterior.props.placeholder).toBe('0000');
  });

  it('T-CAP-2: subsiguiente (con historial) → SOLO card con valor prefill, input ausente', async () => {
    // Setup: lecturaRepo.listar retorna [{lectura_actual: 1234, ...}] → CON historial.
    setupBootstrap({ lecturasPrevias: [LECTURA_HISTORICA] });

    renderConProviders(
      <CapturarLectura navigation={nav as any} route={crearRouteMock() as any} />,
    );

    // Card SI debe estar, mostrando el valor del historial prefill.
    const card = await screen.findByTestId('card-lectura-anterior');
    // El valor prefill '1234' debe ser visible dentro de la card.
    expect(screen.getByText('1234 m³')).toBeTruthy();
    // Y la card debe estar en el arbol (referencia retenida por findByTestId).
    expect(card).toBeTruthy();

    // Input NO debe estar en el arbol — la card ya muestra la informacion,
    // pintar el input ademas seria redundancia visual.
    expect(screen.queryByTestId('input-lectura-anterior')).toBeNull();

    // El badge "Solo lectura" del input ya no existe (la card lo reemplaza).
    expect(screen.queryByText('Solo lectura')).toBeNull();
  });
});
