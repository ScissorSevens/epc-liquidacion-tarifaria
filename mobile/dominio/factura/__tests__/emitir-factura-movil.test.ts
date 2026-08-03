import {
  emitirFacturaMovil,
  type BootstrapFacturaEmision,
  type SnapshotFacturaMovil,
} from '../emitir-factura-movil';
import { crearFacturaRepositoryInMemory } from './factura-repository-in-memory';
import { crearRepositoriosEmision } from '../../../src/composition/emision-repositories';
import { calcularHash } from '../../calculo/calculo';
import type { Hasher, IdGenerator } from '../../shared/ports';
import type { ConsecutivoFacturaProvider } from '../types';

const hasher: Hasher = {
  sha256: (value) => `hash-${value.length}`,
};

const idGen: IdGenerator = {
  uuid: () => 'factura-id-1',
};

function crearResultado() {
  return {
    id_prestador: 1,
    estrato: 2 as const,
    categoria_uso: 'residencial' as const,
    consumo_m3: 12,
    consumo_efectivo_m3: 12,
    bloques: [],
    cargo_fijo: 5000,
    cc_unitario: 1000,
    cc_total: 12000,
    subsidio: 0,
    contribucion: 0,
    total: 17000,
    factor_aplicado: 0,
    metadata: {
      norma_aplicada: 'Res CRA 825/2017',
      acuerdo_id: null,
      parametros_id: 1,
      cmviaa_aplicado: false,
      minimo_vital_aplicado: false,
      factor_capeado: false,
      version_motor: '825-907-v1',
      calculo_timestamp: '2026-01-31T10:00:00.000Z',
    },
  };
}

function crearEntidades() {
  const resultado = crearResultado();
  const lectura = {
    id_medidor: 10,
    id_periodo: '202601',
    id_operario: 7,
    lectura_actual: 1012,
    lectura_anterior: 1000,
    estado_validacion: 'validado' as const,
    timestamp_captura: '2026-02-01T08:30:00.000Z',
    estado_sync: 'pendiente' as const,
    id_prestador: 1,
  };
  const suscriptor = {
    id_suscriptor: 1,
    codigo: '00001',
    nombre_apellidos: 'Maria Lopez',
    cedula: '123456789',
    municipio: 'Bogota',
    direccion: 'Calle 1',
    estrato: 2 as const,
    aplica_subsidio: false,
    id_prestador: 1,
    categoria_uso: 'residencial' as const,
    estado: 'activo' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const medidor = {
    id_medidor: 10,
    numero_medidor: 'MED-10',
    id_suscriptor: 1,
    fecha_instalacion: '2024-01-01',
    estado: 'activo' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const periodo = {
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
  const operario = {
    id_operario: 7,
    id_prestador: 1,
    numero_cedula: '987654321',
    nombre: 'Ana Gomez',
    email: 'ana@example.test',
    password_hash: 'never-in-snapshot',
    rol: 'operario' as const,
    estado: 'activo' as const,
    dispositivo_id: 'MZ-001',
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const prestador = {
    id_prestador: 1,
    codigo: 'P-1',
    nombre: 'Aguas de Cundinamarca',
    nit: '800.123.456-7',
    municipio: 'Bogota',
    departamento: 'Cundinamarca',
    representante_legal: null,
    representante_legal_cedula: null,
    segmento: 2 as const,
    num_suscriptores_urbanos: 1,
    num_suscriptores_rurales: 1,
    contacto: null,
    estado: 'activo' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    aps: null,
  };
  const liquidacionBase = {
    id: 'liq-1',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-01-31T10:00:00.000Z'),
    resultado,
    estado: 'ACTIVA' as const,
  };
  const liquidacion = {
    ...liquidacionBase,
    hash: calcularHash(liquidacionBase, hasher),
  };
  return { resultado, lectura, suscriptor, medidor, periodo, operario, prestador, liquidacion };
}

function crearBootstrap(): {
  bootstrap: BootstrapFacturaEmision;
  provider: ConsecutivoFacturaProvider;
  entidades: ReturnType<typeof crearEntidades>;
} {
  const entidades = crearEntidades();
  const reposEmision = crearRepositoriosEmision();
  void reposEmision.periodoRepo.guardar(entidades.periodo);
  void reposEmision.liquidacionRepo.guardar(entidades.liquidacion);
  const provider: ConsecutivoFacturaProvider = {
    proximo: jest.fn().mockResolvedValue(7),
  };
  const bootstrap = {
    repos: {
      facturaRepo: crearFacturaRepositoryInMemory(),
      suscriptorRepo: { buscarPorId: jest.fn().mockResolvedValue(entidades.suscriptor) },
      medidorRepo: { buscarPorId: jest.fn().mockResolvedValue(entidades.medidor) },
      periodoRepo: reposEmision.periodoRepo,
      liquidacionRepo: reposEmision.liquidacionRepo,
      consumoHistoricoRepo: {
        listarPorSuscriptor: jest.fn().mockResolvedValue([
          { id_periodo: '202512', consumo_m3: 10, total_facturado: 15000 },
        ]),
      },
      operarioRepo: { buscarPorId: jest.fn().mockResolvedValue(entidades.operario) },
      prestadorRepo: { obtenerPorId: jest.fn().mockResolvedValue(entidades.prestador) },
    },
    adapters: { hasher, idGenerator: idGen },
    services: {
      consecutivoProvider: provider,
      resolverContextoPrestador: jest.fn().mockResolvedValue({
        prestador: entidades.prestador,
        parametros: null,
        acuerdo: null,
      }),
    },
  } as unknown as BootstrapFacturaEmision;
  return { bootstrap, provider, entidades };
}

describe('emitirFacturaMovil con BootstrapApp', () => {
  it('hidrata entidades, asigna consecutivo y persiste una factura completa', async () => {
    const { bootstrap, provider, entidades } = crearBootstrap();
    const snapshot: SnapshotFacturaMovil = {
      lectura: entidades.lectura,
      id_suscriptor: entidades.suscriptor.id_suscriptor,
      id_liquidacion: entidades.liquidacion.id,
      prestador: entidades.prestador,
      resultado: entidades.resultado,
      otros_valores: [{ concepto: 'RECONEXION', valor: 5000 }],
      saldo_anterior: 3000,
    };

    const factura = await emitirFacturaMovil(
      bootstrap,
      snapshot,
      '2026-02-01',
      hasher,
      idGen,
      provider,
    );

    expect(provider.proximo).toHaveBeenCalledWith('MZ-001');
    expect(factura.estado).toBe('EMITIDA');
    expect(factura.numero_factura).toBe('MZ-001-7');
    expect(factura.id_factura).toBe('factura-id-1');
    expect(factura.snapshot.suscriptor.nombre_apellidos).toBe('Maria Lopez');
    expect(factura.snapshot.consumosHistoricos).toHaveLength(1);
    await expect(bootstrap.repos.facturaRepo.buscarPorId(factura.id)).resolves.toMatchObject({
      id: 'factura-id-1',
      estado: 'EMITIDA',
    });
  });

  it('lanza error tipado cuando no encuentra el suscriptor', async () => {
    const { bootstrap, entidades } = crearBootstrap();
    (bootstrap.repos.suscriptorRepo.buscarPorId as jest.Mock).mockResolvedValue(null);

    await expect(
      emitirFacturaMovil(bootstrap, { lectura: entidades.lectura }, '2026-02-01', hasher, idGen),
    ).rejects.toMatchObject({
      code: 'EMITIR_FACTURA_SUSCRIPTOR_NO_ENCONTRADO',
    });
  });
});
