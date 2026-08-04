/**
 * Wiring UI ↔ dominio para emision de Factura desde la pantalla
 * `ResultadoCalculo`.
 *
 * Funciones:
 *  - `hidratarEmitirFacturaInput(deps, lectura)` — recibe un objeto
 *    `HidratarDeps` con los repositorios que necesita. Hidrata
 *    Suscriptor, Medidor, Periodo, Operario, Liquidacion, lectura y
 *    consumos historicos; valida hash de liquidacion; resuelve el
 *    prestador.
 *  - `emitirFacturaMovil(input, deps, fechaActual)` — wrapper sobre
 *    `emitirFacturaConRepo` que asigna consecutivo via
 *    `ConsecutivoFacturaProvider` per-device.
 *
 * El orquestador puro (`emitirFacturaConRepo`) permanece intacto:
 * este modulo solo agrega el wiring paralelo de hidratacion para la UI.
 *
 * Spec: `factura-emision-movil` REQ 1-5 + `factura-delta` REQ 1-3.
 */

import type {
  EmitirFacturaInput,
  Factura,
  ConsecutivoFacturaProvider,
  FacturaRepository,
  ConsumoHistorico,
} from '../../dominio/factura/types';
import { MENSAJES_ERROR_FACTURA } from '../../dominio/factura/types';
import type { Hasher, IdGenerator } from '../../dominio/shared/ports';
import { emitirFacturaConRepo } from '../../dominio/factura/factura-con-repo';
import type { Suscriptor } from '../../dominio/suscriptores/types';
import type { Medidor } from '../../dominio/medidores/types';
import type { Periodo } from '../../dominio/periodos/types';
import type { Operario } from '../../dominio/operarios/types';
import type { Prestador } from '../../dominio/prestadores/types';
import type { Liquidacion } from '../../dominio/calculo/types';
import type { Lectura } from '../../dominio/captura-lecturas/types';

/**
 * Dependencias minimas para `hidratarEmitirFacturaInput`. Los repos
 * se inyectan para que la funcion sea testeable sin SQLite ni
 * BootstrapApp completo.
 */
export interface HidratarDeps {
  readonly suscriptorRepo: { buscarPorId(id: number): Promise<Suscriptor | null> };
  readonly medidorRepo: { buscarPorId(id: number): Promise<Medidor | null> };
  readonly periodoRepo: { buscarPorId(id_periodo: string): Promise<Periodo | null> };
  readonly operarioRepo: { buscarPorId(id: number): Promise<Operario | null> };
  readonly liquidacionRepo: { buscarPorId(id: string): Promise<Liquidacion | null> };
  readonly consumoHistoricoRepo: {
    listarPorSuscriptor(id_suscriptor: number): Promise<readonly ConsumoHistorico[]>;
  };
  readonly prestadorProvider: (id_prestador: number) => Promise<Prestador>;
}

/**
 * Lee las entidades del repositorio en paralelo y construye un
 * `EmitirFacturaInput` listo para `emitirFacturaConRepo`.
 *
 * Valida que el hash de la liquidacion sea no-vacio (defensa contra
 * corrupcion: si la liquidacion fue creada sin hash o su hash fue
 * alterado, rechazamos con `LIQUIDACION_INTEGRIDAD_ROTA`).
 */
export async function hidratarEmitirFacturaInput(
  deps: HidratarDeps,
  lectura: Lectura,
): Promise<EmitirFacturaInput> {
  const [suscriptor, medidor, periodo, operario, liquidacion, consumosHistoricos] =
    await Promise.all([
      deps.suscriptorRepo.buscarPorId(lectura.id_medidor),
      deps.medidorRepo.buscarPorId(lectura.id_medidor),
      deps.periodoRepo.buscarPorId(lectura.id_periodo),
      deps.operarioRepo.buscarPorId(lectura.id_operario),
      deps.liquidacionRepo.buscarPorId(lectura.id_periodo),
      deps.consumoHistoricoRepo.listarPorSuscriptor(lectura.id_medidor),
    ]);

  if (!suscriptor) {
    throw new Error('hidratarEmitirFacturaInput: suscriptor no encontrado');
  }
  if (!medidor) {
    throw new Error('hidratarEmitirFacturaInput: medidor no encontrado');
  }
  if (!periodo) {
    throw new Error('hidratarEmitirFacturaInput: periodo no encontrado');
  }
  if (!operario) {
    throw new Error('hidratarEmitirFacturaInput: operario no encontrado');
  }
  if (!liquidacion) {
    throw new Error('hidratarEmitirFacturaInput: liquidacion no encontrada');
  }

  if (!liquidacion.hash || liquidacion.hash.length === 0) {
    throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_INTEGRIDAD_ROTA);
  }

  const prestador = await deps.prestadorProvider(lectura.id_prestador ?? 0);

  return {
    suscriptor,
    medidor,
    periodo,
    operario,
    prestador,
    lectura,
    liquidacion,
    consumosHistoricos,
    fechaEmision: new Date(lectura.timestamp_captura).toISOString().slice(0, 10),
    consecutivo: 0, // se asigna en emitirFacturaMovil
  };
}

/**
 * Dependencias para `emitirFacturaMovil`. Necesita el
 * `FacturaRepository` (donde persiste), `Hasher`, `IdGenerator`, y
 * el `ConsecutivoFacturaProvider` per-device.
 */
export interface EmitirDeps {
  readonly facturaRepo: FacturaRepository;
  readonly consecutivoProvider: ConsecutivoFacturaProvider;
  readonly hasher: Hasher;
  readonly idGenerator: IdGenerator;
}

/**
 * Wrapper sobre `emitirFacturaConRepo`. Asigna consecutivo via
 * `ConsecutivoFacturaProvider` per-device, hidrata `fechaEmision` con
 * `fechaActual` si el input no lo trae, y persiste via repo.
 */
export async function emitirFacturaMovil(
  input: EmitirFacturaInput,
  deps: EmitirDeps,
  fechaActual: string,
): Promise<Factura> {
  const dispositivoId = input.operario.dispositivo_id ?? 'sin-dispositivo';
  const inputConConsecutivo: EmitirFacturaInput = {
    ...input,
    fechaEmision: fechaActual,
    consecutivo: await deps.consecutivoProvider.proximo(dispositivoId),
  };
  return emitirFacturaConRepo(
    inputConConsecutivo,
    deps.facturaRepo,
    deps.hasher,
    deps.idGenerator,
  );
}
