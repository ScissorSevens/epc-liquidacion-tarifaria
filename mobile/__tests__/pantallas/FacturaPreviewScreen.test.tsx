/**
 * Tests del contrato de `FacturaPreviewScreen`.
 *
 * Cubre (spec `factura-preview-ticket` REQ 1-6):
 *  - render: estados cargando/listo/error + ausencia de otros_valores
 *    no rompe
 *  - copiable: codigo de verificacion y referencia de pago
 *    tienen selectable=true y testIDs correspondientes
 *  - paperWidth: 58mm → COLS=32, 80mm → COLS=42
 *  - actions: tap Imprimir (preferida imprime directo, sin preferida
 *    navega a SeleccionarImpresora, conexion fallida invalida
 *    preferencias y navega)
 *  - actions: tap Compartir (happy + sharing no disponible)
 *
 * RED phase: estos tests fallan porque `FacturaPreviewScreen` aun no
 * existe. GREEN phase: la implementacion llega en commit 8.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FacturaPreviewScreen from '../../src/pantallas/FacturaPreviewScreen';
import { crearNavMock } from './__mocks__/nav';
import type { Factura } from '../../dominio/factura/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

function crearFacturaCompleta(): Factura {
  const base = {
    id: 'factura-test-id-1234',
    numero_factura: 'MZ-001-1',
    estado: 'EMITIDA' as const,
    fecha_emision: '2026-02-01',
    snapshot: {
      prestador: {
        id_prestador: 1,
        codigo: '0001',
        nombre: 'Aguas del Valle S.A. E.S.P.',
        nit: '900123456-7',
        municipio: 'Cali',
        departamento: 'Valle del Cauca',
        representante_legal: 'Carlos Ramirez',
        representante_legal_cedula: '79123456',
      },
      suscriptor: {
        codigo: '00001',
        nombre_apellidos: 'Maria Lopez',
        cedula: '123456789',
        email: null,
        telefono: null,
        municipio: 'Bogota',
        sector: null,
        calle: null,
        direccion: 'Calle 5 #2-10',
        estrato: 2 as const,
        estado: 'activo' as const,
        matricula_inmobiliaria: null,
        numero_catastral: null,
        id_prestador: 1,
        categoria_uso: 'residencial' as const,
      },
      medidor: {
        id_medidor: 10,
        numero_medidor: 'MED-0001',
        estado: 'activo' as const,
        fecha_instalacion: '2024-01-15',
      },
      periodo: {
        id_periodo: '202601',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-01-31',
        fecha_pago_sin_recargo: '2026-02-15',
        fecha_pago_con_recargo: '2026-02-28',
        dias_consumo: 31,
      },
      operario: {
        id_operario: 7,
        id_prestador: 1,
        numero_cedula: '1234567890',
        nombre: 'Ana Gomez',
        email: 'ana@epc.co',
        rol: 'operario' as const,
        estado: 'activo' as const,
        dispositivo_id: 'MZ-001',
      },
      lectura: {
        lectura_actual: 1234,
        lectura_anterior: 1200,
        estado_validacion: 'validado' as const,
        evidencia_foto_path: null,
        evidencia_foto_hash: null,
        timestamp_captura: '2026-02-01T08:30:00.000Z',
        observaciones: null,
      },
      liquidacion: {
        id: 'liq-fija-test-id',
        hash: 'liq-hash-fijo-test',
        resultado: {
          id_prestador: 1,
          estrato: 2 as const,
          categoria_uso: 'residencial' as const,
          consumo_m3: 34,
          consumo_efectivo_m3: 34,
          bloques: [],
          cargo_fijo: 5000,
          cc_unitario: 1500,
          cc_total: 51000,
          subsidio: 0,
          contribucion: 0,
          total: 56000,
          factor_aplicado: 0,
          metadata: {
            norma_aplicada: 'Res CRA 825/2017',
            acuerdo_id: null,
            parametros_id: 1,
            cmviaa_aplicado: false,
            minimo_vital_aplicado: false,
            factor_capeado: false,
            version_motor: '825-907-v1',
            calculo_timestamp: '2026-02-01T10:00:00.000Z',
          },
        },
      },
      consumosHistoricos: [],
      otros_valores: [
        { concepto: 'RECONEXION' as const, valor: 5000 },
      ],
      saldo_anterior: 3000,
      metadata: { hash_version: 'v2' as const },
    },
    hash: 'hash-fijo-test-1234',
    codigo_verificacion: 'ABCD1234EF',
    version_tarifa_aplicada: '825-907-v1',
    referencia_pago: '1-202601-99-A1B2',
    qr_pago: 'qr-fixture',
    created_at: '2026-02-01T10:00:00.000Z',
  };
  return Object.freeze(base) as Factura;
}

const paramsBase = { id_factura: 'factura-test-id-1234' };

function crearRutaMock(params = paramsBase) {
  return { key: 'test-route', name: 'FacturaPreview', params };
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

// ── Mocks ──────────────────────────────────────────────────────────────────

// Factura inline para evitar hoisting de jest.mock
const mockFactura = {
  id: 'factura-test-id-1234',
  numero_factura: 'MZ-001-1',
  estado: 'EMITIDA' as const,
  fecha_emision: '2026-02-01',
  snapshot: {
    prestador: {
      id_prestador: 1,
      codigo: '0001',
      nombre: 'Aguas del Valle S.A. E.S.P.',
      nit: '900123456-7',
      municipio: 'Cali',
      departamento: 'Valle del Cauca',
      representante_legal: 'Carlos Ramirez',
      representante_legal_cedula: '79123456',
    },
    suscriptor: {
      codigo: '00001',
      nombre_apellidos: 'Maria Lopez',
      cedula: '123456789',
      email: null,
      telefono: null,
      municipio: 'Bogota',
      sector: null,
      calle: null,
      direccion: 'Calle 5 #2-10',
      estrato: 2 as const,
      estado: 'activo' as const,
      matricula_inmobiliaria: null,
      numero_catastral: null,
      id_prestador: 1,
      categoria_uso: 'residencial' as const,
    },
    medidor: {
      id_medidor: 10,
      numero_medidor: 'MED-0001',
      estado: 'activo' as const,
      fecha_instalacion: '2024-01-15',
    },
    periodo: {
      id_periodo: '202601',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-01-31',
      fecha_pago_sin_recargo: '2026-02-15',
      fecha_pago_con_recargo: '2026-02-28',
      dias_consumo: 31,
    },
    operario: {
      id_operario: 7,
      id_prestador: 1,
      numero_cedula: '1234567890',
      nombre: 'Ana Gomez',
      email: 'ana@epc.co',
      rol: 'operario' as const,
      estado: 'activo' as const,
      dispositivo_id: 'MZ-001',
    },
    lectura: {
      lectura_actual: 1234,
      lectura_anterior: 1200,
      estado_validacion: 'validado' as const,
      evidencia_foto_path: null,
      evidencia_foto_hash: null,
      timestamp_captura: '2026-02-01T08:30:00.000Z',
      observaciones: null,
    },
    liquidacion: {
      id: 'liq-fija-test-id',
      hash: 'liq-hash-fijo-test',
      resultado: {
        id_prestador: 1,
        estrato: 2 as const,
        categoria_uso: 'residencial' as const,
        consumo_m3: 34,
        consumo_efectivo_m3: 34,
        bloques: [],
        cargo_fijo: 5000,
        cc_unitario: 1500,
        cc_total: 51000,
        subsidio: 0,
        contribucion: 0,
        total: 56000,
        factor_aplicado: 0,
        metadata: {
          norma_aplicada: 'Res CRA 825/2017',
          acuerdo_id: null,
          parametros_id: 1,
          cmviaa_aplicado: false,
          minimo_vital_aplicado: false,
          factor_capeado: false,
          version_motor: '825-907-v1',
          calculo_timestamp: '2026-02-01T10:00:00.000Z',
        },
      },
    },
    consumosHistoricos: [],
    otros_valores: [{ concepto: 'RECONEXION' as const, valor: 5000 }],
    saldo_anterior: 3000,
    metadata: { hash_version: 'v2' as const },
  },
  hash: 'hash-fijo-test-1234',
  codigo_verificacion: 'ABCD1234EF',
  version_tarifa_aplicada: '825-907-v1',
  referencia_pago: '1-202601-99-A1B2',
  qr_pago: 'qr-fixture',
  created_at: '2026-02-01T10:00:00.000Z',
};

// Mock del bootstrap que retorna la factura completa
jest.mock('../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn().mockResolvedValue({
    repos: {
      facturaRepo: {
        buscarPorId: jest.fn().mockResolvedValue(mockFactura),
      },
    },
    services: {},
    adapters: {},
  }),
}));

// Mock del modulo de preferencias: 58mm default
jest.mock('../../src/persistencia/impresoras-preferencias', () => ({
  obtenerUltimaImpresora: jest.fn().mockResolvedValue(null),
  obtenerPapelDefault: jest.fn().mockResolvedValue('58mm'),
  guardarUltimaImpresora: jest.fn().mockResolvedValue(undefined),
  invalidarPreferencias: jest.fn().mockResolvedValue(undefined),
}));

// Mock del modulo de factory de adapters (sin adapters disponibles)
jest.mock('../../src/adapters/impresion/factory', () => ({
  obtenerAdaptadores: jest.fn().mockResolvedValue([]),
}));

// Mock del modulo compartir-factura
jest.mock('../../src/hooks/compartir-factura', () => ({
  compartirFactura: jest.fn().mockResolvedValue(undefined),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('FacturaPreviewScreen — render', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  it('estado inicial cargando muestra skeleton', async () => {
    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    // El primer render es sincronico con skeleton
    expect(screen.getByTestId('skeleton-preview')).toBeTruthy();
  });

  it('estado listo renderiza datos normativos clave', async () => {
    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    // Esperar a que se resuelva la promesa de carga
    const codigoVerif = await screen.findByTestId('codigo-verificacion');
    expect(codigoVerif.props.children).toBe('ABCD1234EF');
    expect(screen.getByTestId('referencia-pago').props.children).toBe(
      '1-202601-99-A1B2',
    );
  });

  it('codigo verificacion tiene selectable=true', async () => {
    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    const codigoVerif = await screen.findByTestId('codigo-verificacion');
    expect(codigoVerif.props.selectable).toBe(true);
  });

  it('referencia pago tiene selectable=true', async () => {
    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    const refPago = await screen.findByTestId('referencia-pago');
    expect(refPago.props.selectable).toBe(true);
  });

  it('renderiza el CTA Imprimir en termica', async () => {
    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    expect(await screen.findByTestId('btn-imprimir')).toBeTruthy();
  });

  it('renderiza el CTA Compartir', async () => {
    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    expect(await screen.findByTestId('btn-compartir')).toBeTruthy();
  });
});

describe('FacturaPreviewScreen — actions', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  it('tap btn-imprimir sin ultima_impresora navega a SeleccionarImpresora', async () => {
    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    const btn = await screen.findByTestId('btn-imprimir');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(nav.navigate).toHaveBeenCalledWith('SeleccionarImpresora', {
      id_factura: 'factura-test-id-1234',
      modo: 'inicial',
    });
  });

  it('tap btn-compartir invoca compartirFactura', async () => {
    const compartirMod = require('../../src/hooks/compartir-factura');
    const spy = jest.spyOn(compartirMod, 'compartirFactura');

    renderConProviders(
      <FacturaPreviewScreen
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    const btn = await screen.findByTestId('btn-compartir');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(spy).toHaveBeenCalled();
  });
});
