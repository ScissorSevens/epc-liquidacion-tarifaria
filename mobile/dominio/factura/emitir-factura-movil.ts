import { emitirFactura, verificarIntegridadFactura } from './factura';
import { emitirFacturaConRepo } from './factura-con-repo';
import type {
  ConsecutivoFacturaProvider,
  ConsumoHistorico,
  EmitirFacturaInput,
  Factura,
  FacturaRepository,
  FacturaSnapshot,
  OtroValor,
} from './types';
import { MENSAJES_ERROR_FACTURA } from './types';
import type { Liquidacion } from '../calculo/types';
import type { ResultadoCalculo } from '../motor-tarifario/types';
import type { Lectura } from '../captura-lecturas/types';
import type { Medidor } from '../medidores/types';
import type { Operario } from '../operarios/types';
import type { Periodo } from '../periodos/types';
import type { Prestador } from '../prestadores/types';
import type { Suscriptor } from '../suscriptores/types';
import type { Hasher, IdGenerator } from '../shared/ports';

/** Factura devuelta por el servicio con el alias de id usado por la UI móvil. */
export type FacturaPersistida = Factura & { readonly id_factura: string };

export type CodigoErrorEmisionMovil =
  | 'EMITIR_FACTURA_SUSCRIPTOR_NO_ENCONTRADO'
  | 'EMITIR_FACTURA_MEDIDOR_NO_ENCONTRADO'
  | 'EMITIR_FACTURA_PERIODO_NO_ENCONTRADO'
  | 'EMITIR_FACTURA_OPERARIO_NO_ENCONTRADO'
  | 'EMITIR_FACTURA_LIQUIDACION_NO_ENCONTRADA'
  | 'EMITIR_FACTURA_LECTURA_NO_ENCONTRADA'
  | 'EMITIR_FACTURA_PRESTADOR_NO_ENCONTRADO';

export class ErrorEmisionFacturaMovil extends Error {
  readonly code: CodigoErrorEmisionMovil;
  readonly codigo: CodigoErrorEmisionMovil;

  constructor(code: CodigoErrorEmisionMovil, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'ErrorEmisionFacturaMovil';
    this.code = code;
    this.codigo = code;
  }
}

/**
 * Snapshot mínimo que ResultadoCalculo conoce al terminar una liquidación.
 * Las entidades restantes se resuelven desde BootstrapApp.
 */
export interface SnapshotFacturaMovil {
  readonly lectura?: Lectura;
  readonly id_lectura?: number;
  readonly id_suscriptor?: number;
  readonly id_liquidacion?: string;
  readonly prestador?: Prestador;
  readonly resultado?: ResultadoCalculo;
  readonly otros_valores?: readonly OtroValor[];
  readonly otrosValores?: readonly OtroValor[];
  readonly saldo_anterior?: number;
  readonly saldoAnterior?: number;
  readonly observaciones?: string;
  readonly suscriptor?: Suscriptor;
  readonly medidor?: Medidor;
  readonly periodo?: Periodo;
  readonly operario?: Operario;
  readonly liquidacion?: Liquidacion;
  readonly consumosHistoricos?: readonly ConsumoHistorico[];
}

interface FacturaRepositoryCompatible extends Partial<FacturaRepository> {
  readonly guardar?: (factura: Factura) => Promise<Factura>;
  readonly eliminar?: (id: string) => Promise<void>;
}

interface BootstrapReposFactura {
  readonly facturaRepo: FacturaRepositoryCompatible;
  readonly lecturaRepo?: { buscarPorId(id: number): Promise<Lectura | null> };
  readonly suscriptorRepo: { buscarPorId(id: number): Promise<Suscriptor | null> };
  readonly medidorRepo: { buscarPorId(id: number): Promise<Medidor | null> };
  readonly periodoRepo: { buscarPorId(id: string): Promise<Periodo | null> };
  readonly liquidacionRepo: { buscarPorId(id: string): Promise<Liquidacion | null> };
  readonly operarioRepo: { buscarPorId(id: number): Promise<Operario | null> };
  readonly consumoHistoricoRepo: {
    listarPorSuscriptor(id: number): Promise<readonly ConsumoHistorico[]>;
  };
  readonly prestadorRepo?: {
    obtenerPorId(id: number): Promise<Prestador | null>;
  };
}

export interface BootstrapFacturaEmision {
  readonly repos: BootstrapReposFactura;
  readonly adapters?: {
    readonly hasher?: Hasher;
    readonly idGenerator?: IdGenerator;
  };
  readonly services?: {
    readonly consecutivoProvider?: ConsecutivoFacturaProvider | {
      proximo?: (dispositivoId: string) => Promise<number>;
      siguiente?: (dispositivoId: string) => Promise<number>;
    };
    readonly resolverContextoPrestador?: (id: number) => Promise<{
      prestador: Prestador;
      parametros?: unknown;
      acuerdo?: unknown;
    }>;
  };
  readonly consecutivoProvider?: ConsecutivoFacturaProvider | {
    proximo?: (dispositivoId: string) => Promise<number>;
    siguiente?: (dispositivoId: string) => Promise<number>;
  };
}

interface EmitirDepsLegacy {
  readonly facturaRepo: FacturaRepository;
  readonly consecutivoProvider: ConsecutivoFacturaProvider;
  readonly hasher: Hasher;
  readonly idGenerator: IdGenerator;
}

function esBootstrap(value: unknown): value is BootstrapFacturaEmision {
  return typeof value === 'object' && value !== null && 'repos' in value;
}

function esEmitirFacturaInput(value: SnapshotFacturaMovil): value is EmitirFacturaInput {
  return (
    value.suscriptor !== undefined &&
    value.medidor !== undefined &&
    value.periodo !== undefined &&
    value.operario !== undefined &&
    value.prestador !== undefined &&
    value.lectura !== undefined &&
    value.liquidacion !== undefined &&
    value.consumosHistoricos !== undefined
  );
}

function errorEntidad(
  codigo: CodigoErrorEmisionMovil,
  detail: string,
): ErrorEmisionFacturaMovil {
  return new ErrorEmisionFacturaMovil(codigo, detail);
}

function fechaEsDia(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function agregarAliasId(factura: Factura): FacturaPersistida {
  const persistida = { ...factura } as FacturaPersistida;
  Object.defineProperty(persistida, 'id_factura', {
    value: factura.id,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(persistida);
}

function obtenerProvider(
  bootstrap: BootstrapFacturaEmision,
  explicit?: BootstrapFacturaEmision['consecutivoProvider'],
): BootstrapFacturaEmision['consecutivoProvider'] {
  return explicit ?? bootstrap.services?.consecutivoProvider ?? bootstrap.consecutivoProvider;
}

async function siguienteConsecutivo(
  provider: BootstrapFacturaEmision['consecutivoProvider'],
  dispositivoId: string,
): Promise<number> {
  if (provider?.proximo !== undefined) return provider.proximo(dispositivoId);
  if (
    provider !== undefined &&
    'siguiente' in provider &&
    provider.siguiente !== undefined
  ) {
    return provider.siguiente(dispositivoId);
  }
  throw new Error('emitirFacturaMovil: consecutivoProvider es requerido');
}

async function hidratarDesdeBootstrap(
  bootstrap: BootstrapFacturaEmision,
  snapshot: SnapshotFacturaMovil,
  hasher: Hasher,
  fechaEmision: string,
): Promise<EmitirFacturaInput> {
  const lectura =
    snapshot.lectura ??
    (snapshot.id_lectura !== undefined && bootstrap.repos.lecturaRepo !== undefined
      ? await bootstrap.repos.lecturaRepo.buscarPorId(snapshot.id_lectura)
      : null);
  if (!lectura) {
    throw errorEntidad('EMITIR_FACTURA_LECTURA_NO_ENCONTRADA', 'la lectura no existe');
  }

  const [medidorRepoValue, periodoRepoValue, operarioRepoValue] = await Promise.all([
    bootstrap.repos.medidorRepo?.buscarPorId(lectura.id_medidor),
    bootstrap.repos.periodoRepo?.buscarPorId(lectura.id_periodo),
    bootstrap.repos.operarioRepo?.buscarPorId(lectura.id_operario),
  ]);

  const medidor = medidorRepoValue ?? snapshot.medidor;
  if (!medidor) {
    throw errorEntidad('EMITIR_FACTURA_MEDIDOR_NO_ENCONTRADO', String(lectura.id_medidor));
  }
  const idSuscriptor = snapshot.id_suscriptor ?? medidor.id_suscriptor;
  const [suscriptorRepoValue, historial] = await Promise.all([
    bootstrap.repos.suscriptorRepo?.buscarPorId(idSuscriptor),
    bootstrap.repos.consumoHistoricoRepo?.listarPorSuscriptor(idSuscriptor),
  ]);
  const suscriptor = suscriptorRepoValue ?? snapshot.suscriptor;
  if (!suscriptor) {
    throw errorEntidad('EMITIR_FACTURA_SUSCRIPTOR_NO_ENCONTRADO', String(idSuscriptor));
  }

  const periodo = periodoRepoValue ?? snapshot.periodo;
  if (!periodo) {
    throw errorEntidad('EMITIR_FACTURA_PERIODO_NO_ENCONTRADO', lectura.id_periodo);
  }
  const operario = operarioRepoValue ?? snapshot.operario;
  if (!operario) {
    throw errorEntidad('EMITIR_FACTURA_OPERARIO_NO_ENCONTRADO', String(lectura.id_operario));
  }

  const idLiquidacion = snapshot.id_liquidacion ?? snapshot.liquidacion?.id ?? lectura.id_periodo;
  const liquidacionRepoValue = await bootstrap.repos.liquidacionRepo?.buscarPorId(idLiquidacion);
  const liquidacion = liquidacionRepoValue ?? snapshot.liquidacion;
  if (!liquidacion) {
    throw errorEntidad('EMITIR_FACTURA_LIQUIDACION_NO_ENCONTRADA', idLiquidacion);
  }
  if (!verificarIntegridadFacturaComoLiquidacion(liquidacion, hasher)) {
    throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_INTEGRIDAD_ROTA);
  }

  let prestador = snapshot.prestador;
  if (!prestador && bootstrap.repos.prestadorRepo !== undefined) {
    prestador = (await bootstrap.repos.prestadorRepo.obtenerPorId(suscriptor.id_prestador)) ?? undefined;
  }
  if (!prestador && bootstrap.services?.resolverContextoPrestador !== undefined) {
    prestador = (await bootstrap.services.resolverContextoPrestador(suscriptor.id_prestador)).prestador;
  }
  if (!prestador) {
    throw errorEntidad(
      'EMITIR_FACTURA_PRESTADOR_NO_ENCONTRADO',
      String(suscriptor.id_prestador),
    );
  }

  return {
    suscriptor,
    medidor,
    periodo,
    operario,
    prestador,
    lectura,
    liquidacion,
    consumosHistoricos: historial ?? snapshot.consumosHistoricos ?? [],
    fechaEmision,
    consecutivo: 0,
    otrosValores: snapshot.otros_valores ?? snapshot.otrosValores ?? [],
    saldoAnterior: snapshot.saldo_anterior ?? snapshot.saldoAnterior ?? 0,
    ...(snapshot.observaciones !== undefined && { observaciones: snapshot.observaciones }),
  };
}

/** Verificación local de Liquidacion sin acoplar el servicio a otro aggregate. */
function verificarIntegridadFacturaComoLiquidacion(
  liquidacion: Liquidacion,
  hasher: Hasher,
): boolean {
  const payload = JSON.stringify({
    id: liquidacion.id,
    suscriptorId: liquidacion.suscriptorId,
    fechaGeneracion: liquidacion.fechaGeneracion.toISOString(),
    resultado: liquidacion.resultado,
    estado: liquidacion.estado,
    reemplazaA: liquidacion.reemplazaA ?? null,
  });
  return hasher.sha256(payload) === liquidacion.hash;
}

function adaptarRepoFactura(repo: FacturaRepositoryCompatible): FacturaRepository {
  const listar = async (): Promise<readonly Factura[]> => {
    if (repo.listar !== undefined) return repo.listar();
    return [];
  };
  return {
    async crear(factura: Factura): Promise<Factura> {
      if (repo.guardar !== undefined) return repo.guardar(factura);
      if (repo.crear !== undefined) return repo.crear(factura);
      throw new Error('emitirFacturaMovil: FacturaRepository.guardar es requerido');
    },
    async buscarPorId(id: string): Promise<Factura | null> {
      return repo.buscarPorId?.(id) ?? null;
    },
    async buscarPorPeriodo(idPeriodo: string): Promise<readonly Factura[]> {
      if (repo.buscarPorPeriodo !== undefined) return repo.buscarPorPeriodo(idPeriodo);
      return (await listar()).filter((f) => f.snapshot.periodo.id_periodo === idPeriodo);
    },
    async buscarPorSuscriptor(idSuscriptor: number): Promise<readonly Factura[]> {
      if (repo.buscarPorSuscriptor !== undefined) return repo.buscarPorSuscriptor(idSuscriptor);
      return (await listar()).filter(
        (f) => f.snapshot.suscriptor.codigo === String(idSuscriptor),
      );
    },
    async actualizar(id, cambios): Promise<Factura> {
      if (repo.actualizar !== undefined) return repo.actualizar(id, cambios);
      const existente = await repo.buscarPorId?.(id);
      if (!existente) throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
      if (repo.guardar !== undefined) {
        return repo.guardar({ ...existente, ...cambios });
      }
      return { ...existente, ...cambios };
    },
    async listar(): Promise<readonly Factura[]> {
      return listar();
    },
  };
}

async function persistirComoEmitida(
  input: EmitirFacturaInput,
  bootstrap: BootstrapFacturaEmision,
  hasher: Hasher,
  idGen: IdGenerator,
  provider: BootstrapFacturaEmision['consecutivoProvider'],
  idPendiente?: string,
): Promise<Factura> {
  const dispositivoId = input.operario.dispositivo_id ?? '';
  const consecutivo = await siguienteConsecutivo(provider, dispositivoId);
  const inputConConsecutivo: EmitirFacturaInput = { ...input, consecutivo };
  const repo = bootstrap.repos.facturaRepo;

  // El path normal conserva la validación/unicidad de emitirFacturaConRepo.
  if (repo.actualizar !== undefined || repo.crear !== undefined) {
    const idGenerator =
      idPendiente === undefined
        ? idGen
        : { ...idGen, uuid: () => idPendiente };
    const borrador = await emitirFacturaConRepo(
      inputConConsecutivo,
      adaptarRepoFactura(repo),
      hasher,
      idGenerator,
    );
    try {
      return await (repo.actualizar ?? adaptarRepoFactura(repo).actualizar)(borrador.id, {
        estado: 'EMITIDA',
      });
    } catch (error) {
      await repo.eliminar?.(borrador.id);
      throw error;
    }
  }

  // Compatibilidad con ports mínimos de tests/implementaciones futuras que
  // sólo exponen guardar(). Se genera el aggregate y se persiste ya emitido.
  const idGenerator =
    idPendiente === undefined ? idGen : { ...idGen, uuid: () => idPendiente };
  const borrador = emitirFactura(inputConConsecutivo, hasher, idGenerator);
  const emitida: Factura = Object.freeze({
    ...borrador,
    id: idPendiente ?? idGen.uuid(),
    estado: 'EMITIDA',
    created_at: new Date().toISOString(),
  });
  if (repo.guardar === undefined) {
    throw new Error('emitirFacturaMovil: FacturaRepository.guardar es requerido');
  }
  return repo.guardar(emitida);
}

/**
 * Emite desde BootstrapApp. También conserva el overload legado
 * `(input, deps, fecha)` usado por los tests y callers de la primera versión.
 */
export async function emitirFacturaMovil(
  bootstrap: BootstrapFacturaEmision,
  snapshot: SnapshotFacturaMovil,
  fechaActualOIdPendiente: string,
  hasher?: Hasher,
  idGen?: IdGenerator,
  provider?: BootstrapFacturaEmision['consecutivoProvider'],
): Promise<FacturaPersistida>;
export async function emitirFacturaMovil(
  input: EmitirFacturaInput,
  deps: EmitirDepsLegacy,
  fechaActual: string,
): Promise<Factura>;
export async function emitirFacturaMovil(
  first: BootstrapFacturaEmision | EmitirFacturaInput,
  second: SnapshotFacturaMovil | EmitirDepsLegacy,
  third: string,
  explicitHasher?: Hasher,
  explicitIdGen?: IdGenerator,
  explicitProvider?: BootstrapFacturaEmision['consecutivoProvider'],
): Promise<FacturaPersistida | Factura> {
  if (!esBootstrap(first)) {
    const input = first as EmitirFacturaInput;
    const deps = second as EmitirDepsLegacy;
    const consecutivo = await deps.consecutivoProvider.proximo(
      input.operario.dispositivo_id ?? 'sin-dispositivo',
    );
    return emitirFacturaConRepo(
      { ...input, fechaEmision: third, consecutivo },
      deps.facturaRepo,
      deps.hasher,
      deps.idGenerator,
    );
  }

  const bootstrap = first;
  const snapshot = second as SnapshotFacturaMovil;
  const fechaActual = fechaEsDia(third)
    ? third
    : new Date().toISOString().slice(0, 10);
  const idPendiente = fechaEsDia(third) ? undefined : third;
  const hasher = explicitHasher ?? bootstrap.adapters?.hasher;
  const idGen = explicitIdGen ?? bootstrap.adapters?.idGenerator;
  if (!hasher || !idGen) {
    throw new Error('emitirFacturaMovil: hasher e idGenerator son requeridos');
  }

  const input = esEmitirFacturaInput(snapshot)
    ? {
        ...snapshot,
        fechaEmision: fechaActual,
        otrosValores: snapshot.otrosValores,
        saldoAnterior: snapshot.saldoAnterior,
      }
    : await hidratarDesdeBootstrap(bootstrap, snapshot, hasher, fechaActual);
  const persisted = await persistirComoEmitida(
    input,
    bootstrap,
    hasher,
    idGen,
    obtenerProvider(bootstrap, explicitProvider),
    idPendiente,
  );
  return agregarAliasId(persisted);
}

export { verificarIntegridadFactura };
