// mobile/src/adapters/persistir-y-encolar-alta-suscriptor.ts
//
// Adapter orquestador: alta atomica de SUSCRIPTOR + MEDIDOR desde la
// pantalla `AltaSuscriptor.tsx`. Persiste ambas entidades en SQLite local
// y encola sus items para sync Camino 3 dentro de una sola transaccion.
//
// Por que existe:
//   La pantalla actual necesita crear el par suscriptor/medidor y mantener
//   sus items de cola consistentes. `withTransactionAsync` confirma las cuatro
//   escrituras juntas o las revierte automaticamente si cualquiera falla.
//   No hay compensaciones best-effort ni errores tragados.
//
// El item SUSCRIPTOR se encola antes del MEDIDOR porque su id de cola forma
// `dependeDe` del item MEDIDOR. Todo ocurre en la misma transaccion SQLite.

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
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface MedidorRepoAlta {
  crear(borrador: MedidorBorrador): Promise<Medidor>;
}

export interface ColaRepoAlta {
  guardar(item: ItemCola): Promise<void>;
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
  let resultado: PersistirYEncolarAltaSuscriptorResultado | undefined;

  // expo-sqlite 16 no entrega `tx` a withTransactionAsync; los repos
  // comparten la conexion y sus queries participan en la transaccion activa.
  await suscriptorRepo.withTransactionAsync(async () => {
    const suscriptor = await suscriptorRepo.crear(borradorSuscriptor);

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

    const medidor = await medidorRepo.crear({
      ...borradorMedidor,
      id_suscriptor: suscriptor.id_suscriptor,
    });

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

    resultado = {
      suscriptor,
      medidor,
      idItemSuscriptor: itemSus.id,
      idItemMedidor: itemMed.id,
    };
  });

  if (resultado === undefined) {
    throw new Error('persistirYEncolarAltaSuscriptor: la transaccion finalizo sin resultado');
  }
  return resultado;
}
