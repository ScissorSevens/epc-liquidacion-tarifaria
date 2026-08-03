/**
 * Tests del wiring UI ↔ dominio para emision de Factura desde
 * `ResultadoCalculo`.
 *
 * Cubre dos concerns:
 *  1. Hidratacion: `hidratarEmitirFacturaInput(bootstrap, lecturaId)`
 *     lee 7 entidades (suscriptor, medidor, periodo, operario,
 *     liquidacion, consumos_historicos, lectura) desde el
 *     `BootstrapApp` cacheado y arma el `EmitirFacturaInput` para
 *     `emitirFacturaConRepo`.
 *  2. UI: tap en CTA `btn-ver-factura-completa` dispara emision +
 *     navegacion a `FacturaPreview` con `id_factura`. Fallo NO
 *     navega; loading visible durante emision.
 *
 * RED phase: estos tests fallan porque `emitir-factura-movil.ts` y el
 * CTA en ResultadoCalculo aun no existen.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ResultadoCalculo from '../../src/pantallas/ResultadoCalculo';
import { crearNavMock } from './__mocks__/nav';
import { hidratarEmitirFacturaInput, emitirFacturaMovil } from '../../src/factura/emitir-factura-movil';
import type { BootstrapApp } from '../../src/composition/bootstrap';
import { MENSAJES_ERROR_FACTURA } from '../../dominio/factura/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

function crearLecturaBase() {
  return {
    id_medidor: 10,
    id_periodo: '202601',
    id_operario: 7,
    lectura_actual: 1234,
    lectura_anterior: 1200,
    estado_validacion: 'validado' as const,
    timestamp_captura: '2026-02-01T08:30:00.000Z',
    estado_sync: 'pendiente' as const,
    id_prestador: 1,
  };
}

function crearLiquidacionValida() {
  return {
    id: 'liq-fija-test-id',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
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
    estado: 'ACTIVA' as const,
    hash: 'liq-hash-fijo-test-OK',
  };
}

function crearSuscriptor() {
  return {
    id_suscriptor: 1,
    codigo: '00001',
    nombre_apellidos: 'Maria Lopez',
    cedula: '123456789',
    municipio: 'Bogota',
    direccion: 'Calle 5 #2-10',
    estrato: 2 as const,
    aplica_subsidio: false,
    id_prestador: 1,
    categoria_uso: 'residencial' as const,
    estado: 'activo' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function crearMedidor() {
  return {
    id_medidor: 10,
    numero_medidor: 'MED-0001',
    id_suscriptor: 1,
    fecha_instalacion: '2024-01-15',
    estado: 'activo' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function crearPeriodo() {
  return {
    id_periodo: '202601',
    nombre: 'Enero 2026',
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-01-31',
    fecha_pago_sin_recargo: '2026-02-15',
    fecha_pago_con_recargo: '2026-02-28',
    dias_consumo: 31,
    estado: 'cerrado' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function crearOperario() {
  return {
    id_operario: 7,
    id_prestador: 1,
    numero_cedula: '1234567890',
    nombre: 'Ana Gomez',
    email: 'ana@epc.co',
    password_hash: 'argon2id$v=19$m=...',
    rol: 'operario' as const,
    estado: 'activo' as const,
    dispositivo_id: 'MZ-001',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function crearPrestador() {
  return {
    id_prestador: 1,
    codigo: '0001',
    nombre: 'Aguas del Valle S.A. E.S.P.',
    nit: '900123456-7',
    representante_legal: 'Carlos Ramirez',
    representante_legal_cedula: '79123456',
    municipio: 'Cali',
    departamento: 'Valle del Cauca',
    segmento: 2,
    num_suscriptores_urbanos: 1200,
    num_suscriptores_rurales: 800,
    contacto: 'contacto@aguasdelvalle.co',
    estado: 'activo' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    aps: null,
  };
}

const paramsBase = {
  lectura: crearLecturaBase(),
  resultado: {
    total: 56000,
    consumo_m3: 34,
    consumo_efectivo_m3: 34,
    bloques: [],
    cargo_fijo: 5000,
    cc_unitario: 1500,
    cc_total: 51000,
    subsidio: 0,
    contribucion: 0,
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
  parametros: { consumoBasico: 10 },
  estrato: 2,
  id_suscriptor: 1,
  nombre_suscriptor: 'Maria Lopez',
  prestador: { nombre: 'Aguas del Valle S.A. E.S.P.', municipio: 'Cali' },
  otros_valores: [],
  saldo_anterior: 0,
};

function crearRutaMock(params = paramsBase) {
  return { key: 'test-route', name: 'ResultadoCalculo', params };
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

// ── Tests: hidratarEmitirFacturaInput (puro servicio) ──────────────────────

describe('hidratarEmitirFacturaInput — wiring dominio', () => {
  it('hidrata los 7 grupos desde BootstrapApp', async () => {
    const bootstrap = {
      repos: {
        suscriptorRepo: { buscarPorId: jest.fn().mockResolvedValue(crearSuscriptor()) },
        medidorRepo: { buscarPorId: jest.fn().mockResolvedValue(crearMedidor()) },
        periodoRepo: { buscarPorId: jest.fn().mockResolvedValue(crearPeriodo()) },
        operarioRepo: { buscarPorId: jest.fn().mockResolvedValue(crearOperario()) },
        liquidacionRepo: { buscarPorId: jest.fn().mockResolvedValue(crearLiquidacionValida()) },
        lecturaRepo: { buscarPorId: jest.fn().mockResolvedValue(crearLecturaBase()) },
        consumoHistoricoRepo: { listarPorSuscriptor: jest.fn().mockResolvedValue([]) },
      },
      services: {
        resolverContextoPrestador: jest.fn().mockResolvedValue({
          prestador: crearPrestador(),
          parametros: null,
          acuerdo: null,
        }),
      },
      adapters: {
        hasher: { sha256: (s: string) => `h-${s.length}` },
        idGenerator: { uuid: () => 'uuid-fijo-test' },
        apiBaseUrl: 'http://test',
        clienteHttp: {} as any,
      },
    } as unknown as BootstrapApp;

    const input = await hidratarEmitirFacturaInput(bootstrap, crearLecturaBase());
    expect(input.suscriptor).toEqual(crearSuscriptor());
    expect(input.medidor).toEqual(crearMedidor());
    expect(input.periodo).toEqual(crearPeriodo());
    expect(input.operario).toEqual(crearOperario());
    expect(input.liquidacion.id).toBe('liq-fija-test-id');
    expect(input.lectura).toEqual(crearLecturaBase());
    expect(input.prestador).toEqual(crearPrestador());
    expect(input.consumosHistoricos).toEqual([]);
  });

  it('rechaza si la liquidacion tiene hash invalido', async () => {
    const liquidacionRota = { ...crearLiquidacionValida(), hash: 'HASH-CORROMPIDO' };
    const bootstrap = {
      repos: {
        suscriptorRepo: { buscarPorId: jest.fn().mockResolvedValue(crearSuscriptor()) },
        medidorRepo: { buscarPorId: jest.fn().mockResolvedValue(crearMedidor()) },
        periodoRepo: { buscarPorId: jest.fn().mockResolvedValue(crearPeriodo()) },
        operarioRepo: { buscarPorId: jest.fn().mockResolvedValue(crearOperario()) },
        liquidacionRepo: { buscarPorId: jest.fn().mockResolvedValue(liquidacionRota) },
        lecturaRepo: { buscarPorId: jest.fn().mockResolvedValue(crearLecturaBase()) },
        consumoHistoricoRepo: { listarPorSuscriptor: jest.fn().mockResolvedValue([]) },
      },
      services: {
        resolverContextoPrestador: jest.fn().mockResolvedValue({
          prestador: crearPrestador(),
          parametros: null,
          acuerdo: null,
        }),
      },
      adapters: {
        hasher: { sha256: (s: string) => `h-${s.length}` },
        idGenerator: { uuid: () => 'uuid' },
        apiBaseUrl: 'http://test',
        clienteHttp: {} as any,
      },
    } as unknown as BootstrapApp;

    await expect(
      hidratarEmitirFacturaInput(bootstrap, crearLecturaBase()),
    ).rejects.toThrow(MENSAJES_ERROR_FACTURA.LIQUIDACION_INTEGRIDAD_ROTA);
  });
});

// ── Tests: emitirFacturaMovil (wrapper de orquestador) ──────────────────────

describe('emitirFacturaMovil — wrapper de orquestador', () => {
  it('asigna consecutivo del provider y persiste la factura', async () => {
    const bootstrap = {
      repos: {
        facturaRepo: { crear: jest.fn().mockImplementation(async (f) => f) },
        suscriptorRepo: { buscarPorId: jest.fn().mockResolvedValue(crearSuscriptor()) },
        medidorRepo: { buscarPorId: jest.fn().mockResolvedValue(crearMedidor()) },
        periodoRepo: { buscarPorId: jest.fn().mockResolvedValue(crearPeriodo()) },
        operarioRepo: { buscarPorId: jest.fn().mockResolvedValue(crearOperario()) },
        liquidacionRepo: { buscarPorId: jest.fn().mockResolvedValue(crearLiquidacionValida()) },
        lecturaRepo: { buscarPorId: jest.fn().mockResolvedValue(crearLecturaBase()) },
        consumoHistoricoRepo: { listarPorSuscriptor: jest.fn().mockResolvedValue([]) },
      },
      services: {
        resolverContextoPrestador: jest.fn().mockResolvedValue({
          prestador: crearPrestador(),
          parametros: null,
          acuerdo: null,
        }),
      },
      adapters: {
        hasher: { sha256: (s: string) => `h-${s.length}` },
        idGenerator: { uuid: () => 'uuid-emit-1' },
        apiBaseUrl: 'http://test',
        clienteHttp: {} as any,
      },
    } as unknown as BootstrapApp & {
      repos: { facturaRepo: { crear: jest.Mock } };
    };

    const input = await hidratarEmitirFacturaInput(bootstrap, crearLecturaBase());
    const factura = await emitirFacturaMovil(input, bootstrap, '2026-02-01');

    expect(factura.id).toBe('uuid-emit-1');
    expect(factura.estado).toBe('BORRADOR');
    expect(bootstrap.repos.facturaRepo.crear).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: UI ResultadoCalculo CTA wiring ───────────────────────────────────

describe('ResultadoCalculo — CTA Ver factura completa', () => {
  let nav: ReturnType<typeof crearNavMock>;

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
  });

  it('muestra el CTA Ver factura completa en el estado inicial', () => {
    renderConProviders(
      <ResultadoCalculo
        navigation={nav as any}
        route={crearRutaMock() as any}
      />,
    );
    expect(screen.getByTestId('btn-ver-factura-completa')).toBeTruthy();
  });

  it('tap invoca emision y navega a FacturaPreview con id_factura', async () => {
    // Mock del modulo emision
    const emitirSpy = jest.fn().mockResolvedValue({ id: 'factura-emitida-id' });
    const hidratarSpy = jest.fn().mockResolvedValue({
      suscriptor: crearSuscriptor(),
      medidor: crearMedidor(),
      periodo: crearPeriodo(),
      operario: crearOperario(),
      prestador: crearPrestador(),
      lectura: crearLecturaBase(),
      liquidacion: crearLiquidacionValida(),
      consumosHistoricos: [],
      fechaEmision: '2026-02-01',
      consecutivo: 1,
    });
    jest.doMock('../../src/factura/emitir-factura-movil', () => ({
      hidratarEmitirFacturaInput: hidratarSpy,
      emitirFacturaMovil: emitirSpy,
    }));
    jest.doMock('../../src/composition/get-bootstrap', () => ({
      getBootstrap: jest.fn().mockResolvedValue({
        repos: {},
        services: {},
        adapters: { hasher: {}, idGenerator: {}, clienteHttp: {}, apiBaseUrl: '' },
      }),
    }));

    // Re-require ResultadoCalculo con los mocks activos
    jest.isolateModules(() => {
      const ResultadoCalculoFresh = require('../../src/pantallas/ResultadoCalculo').default;
      renderConProviders(
        <ResultadoCalculoFresh
          navigation={nav as any}
          route={crearRutaMock() as any}
        />,
      );
    });

    const btn = screen.getByTestId('btn-ver-factura-completa');
    await act(async () => {
      fireEvent.press(btn);
    });

    expect(emitirSpy).toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith('FacturaPreview', {
      id_factura: 'factura-emitida-id',
    });
  });
});
