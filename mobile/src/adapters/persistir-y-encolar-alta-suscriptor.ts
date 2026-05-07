// mobile/src/adapters/persistir-y-encolar-alta-suscriptor.ts
//
// Adapter orquestador: alta atomica de SUSCRIPTOR + MEDIDOR desde la
// pantalla `AltaSuscriptor.tsx`. Persiste en SQLite local + encola
// para sync Camino 3, con compensacion si el medidor falla.
//
// Por que existe:
//   La pantalla actual hace persistencia inline (crear suscriptor →
//   crear medidor → si falla medidor, eliminar suscriptor) pero NO
//   encola para sync. El backend nunca ve el suscriptor nuevo. Este
//   adapter cierra el gap reusando el mismo flujo + agregando
//   encolado con `dependeDe` correcto.
//
// Compensacion (best effort):
//   Si crear medidor falla:
//     1. Intentar eliminar suscriptor de SQLite local.
//     2. Intentar eliminar item SUSCRIPTOR de la cola.
//     3. Relanzar el error original del medidor.
//   Las dos compensaciones son independientes: si una falla, la otra
//   se intenta igual. El error que ve el usuario es siempre el del
//   medidor (la causa raiz), no errores de compensacion.
//
// Por que el item SUSCRIPTOR se encola ANTES de intentar el medidor:
//   Necesitamos su `id` para setear `dependeDe` del MEDIDOR. Si fueramos
//   a encolar todo despues, perderiamos la simetria con el adapter de
//   importacion. Trade-off: si crear medidor falla, hay que "deshacer"
//   el item — por eso el `colaRepo.eliminar`.
//
// `colaRepo.eliminar` NO esta en la interface dominio `ColaSincronizacion`
// (congelada D33). Vive solo en `ColaRepositoryExpoSqlite` (mobile).
// Ver `mobile/src/persistencia/expo-sqlite/cola-repository-expo-sqlite.ts`.

import type {
  Suscriptor,
  SuscriptorBorrador,
} from '@dominio/suscriptores/types';
import type { Medidor, MedidorBorrador } from '@dominio/medidores/types';
import type { ItemCola } from '@dominio/sincronizacion/types';
import type { Hasher, IdGenerator } from '@dominio/shared/ports';

/**
 * Borrador del medidor SIN `id_suscriptor`: el adapter lo inyecta
 * tras crear el suscriptor (y obtener su id local).
 */
export type MedidorBorradorSinSuscriptor = Omit<MedidorBorrador, 'id_suscriptor'>;

export interface SuscriptorRepoAlta {
  crear(borrador: SuscriptorBorrador): Promise<Suscriptor>;
  eliminar(idSuscriptor: number): Promise<void>;
}

export interface MedidorRepoAlta {
  crear(borrador: MedidorBorrador): Promise<Medidor>;
}

export interface ColaRepoAlta {
  guardar(item: ItemCola): Promise<void>;
  eliminar(idItem: string): Promise<void>;
}

export interface PersistirYEncolarAltaSuscriptorDeps {
  readonly borradorSuscriptor: SuscriptorBorrador;
  readonly borradorMedidor: MedidorBorradorSinSuscriptor;
  readonly suscriptorRepo: SuscriptorRepoAlta;
  readonly medidorRepo: MedidorRepoAlta;
  readonly colaRepo: ColaRepoAlta;
  readonly idGenerator: IdGenerator;
  readonly hasher: Hasher;
}

export interface PersistirYEncolarAltaSuscriptorResultado {
  readonly suscriptor: Suscriptor;
  readonly medidor: Medidor;
  readonly idItemSuscriptor: string;
  readonly idItemMedidor: string;
}

export async function persistirYEncolarAltaSuscriptor(
  deps: PersistirYEncolarAltaSuscriptorDeps,
): Promise<PersistirYEncolarAltaSuscriptorResultado> {
  const {
    borradorSuscriptor,
    borradorMedidor,
    suscriptorRepo,
    medidorRepo,
    colaRepo,
    idGenerator,
    hasher,
  } = deps;

  // 1. Crear suscriptor (puede tirar — lo dejamos propagar; nada que compensar).
  const suscriptor = await suscriptorRepo.crear(borradorSuscriptor);

  // 2. Encolar SUSCRIPTOR (necesitamos su id para dependeDe del MEDIDOR).
  const itemSus: ItemCola = {
    id: idGenerator.uuid(),
    tipo: 'SUSCRIPTOR',
    payload: suscriptor,
    hashLocal: hasher.sha256(JSON.stringify(suscriptor)),
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    ultimoIntentoEn: null,
    creadoEn: new Date(),
  };
  await colaRepo.guardar(itemSus);

  // 3. Intentar crear MEDIDOR. Si falla → compensacion best-effort.
  let medidor: Medidor;
  try {
    medidor = await medidorRepo.crear({
      ...borradorMedidor,
      id_suscriptor: suscriptor.id_suscriptor,
    });
  } catch (errMedidor) {
    // Compensacion 1: borrar suscriptor de SQLite local.
    try {
      await suscriptorRepo.eliminar(suscriptor.id_suscriptor);
    } catch {
      // Swallowed: la causa que ve el usuario es la del medidor.
      // El suscriptor huerfano queda local pero la cola NO lo va a
      // sincronizar (lo borramos del paso siguiente).
    }
    // Compensacion 2: borrar item SUSCRIPTOR de la cola (independiente
    // del exito de la compensacion 1).
    try {
      await colaRepo.eliminar(itemSus.id);
    } catch {
      // Idem: best effort.
    }
    throw errMedidor;
  }

  // 4. Encolar MEDIDOR con dependeDe = [idItemSuscriptor].
  const itemMed: ItemCola = {
    id: idGenerator.uuid(),
    tipo: 'MEDIDOR',
    payload: medidor,
    hashLocal: hasher.sha256(JSON.stringify(medidor)),
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    ultimoIntentoEn: null,
    creadoEn: new Date(),
    dependeDe: [itemSus.id],
  };
  await colaRepo.guardar(itemMed);

  return {
    suscriptor,
    medidor,
    idItemSuscriptor: itemSus.id,
    idItemMedidor: itemMed.id,
  };
}
