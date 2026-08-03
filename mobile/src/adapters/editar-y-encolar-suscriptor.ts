// mobile/src/adapters/editar-y-encolar-suscriptor.ts
//
// Adapter de edicion offline-first: actualiza Suscriptor en SQLite local
// y lo encola para sincronizacion con el backend.
//
// Diferencias respecto al adapter de alta (`persistir-y-encolar-alta-suscriptor`):
//   - Sin compensacion de medidor (solo actualiza suscriptor, sin entidades relacionadas).
//   - `forzarSobrescribir: true` → SyncHandler Caso C (UPDATE, no INSERT).
//   - Si el UPDATE SQLite falla, lanza — no encola. La pantalla muestra el error.
//   - Almacena Suscriptor raw (idCliente construido al sync por `adapter-cliente-http.ts`
//     usando `'mobile':${sus.id_suscriptor}` — identico al del alta → SyncHandler
//     encuentra el SyncRegistro existente y ejecuta AplicarPayload).
//
// Inversion de dependencias: las interfaces locales evitan importar la
// implementacion concreta expo-sqlite, facilitando tests unitarios.

import type { ActualizarSuscriptorInput, Suscriptor } from '@dominio/suscriptores/types';
import type { ItemCola } from '@dominio/sincronizacion/types';
import type { Hasher, IdGenerator } from '@dominio/shared/ports';

export interface SuscriptorRepoEdicion {
  actualizar(id: number, cambios: ActualizarSuscriptorInput): Promise<Suscriptor>;
}

export interface ColaRepoEdicion {
  guardar(item: ItemCola): Promise<void>;
}

export interface EditarYEncolarSuscriptorDeps {
  readonly idSuscriptor: number;
  readonly cambios: ActualizarSuscriptorInput;
  readonly suscriptorRepo: SuscriptorRepoEdicion;
  readonly colaRepo: ColaRepoEdicion;
  readonly idGenerator: IdGenerator;
  readonly hasher: Hasher;
}

export interface EditarYEncolarSuscriptorResultado {
  readonly suscriptorActualizado: Suscriptor;
  readonly idItemCola: string;
}

/**
 * Actualiza el suscriptor en SQLite local y lo encola para sincronizacion.
 *
 * Garantias:
 *   - Paso 1 falla → lanza, NO encola (atomicidad parcial: SQLite ok = encolar).
 *   - `forzarSobrescribir: true` → el SyncHandler en backend ejecutara Caso C
 *     (UPDATE) usando el mismo `idCliente='mobile':${id_suscriptor}` del alta.
 *   - Payload = Suscriptor raw (adapter-cliente-http.ts construye el idCliente al sync).
 */
export async function editarYEncolarSuscriptor(
  deps: EditarYEncolarSuscriptorDeps,
): Promise<EditarYEncolarSuscriptorResultado> {
  const { idSuscriptor, cambios, suscriptorRepo, colaRepo, idGenerator, hasher } = deps;

  // 1. UPDATE SQLite — si falla, propagar (pantalla muestra error, NO encola)
  const suscriptorActualizado = await suscriptorRepo.actualizar(idSuscriptor, cambios);

  // 2. Encolar con forzarSobrescribir:true → SyncHandler Caso C
  //    Payload = Suscriptor raw. idCliente lo construye adapter-cliente-http.ts
  //    al sincronizar: 'mobile':${sus.id_suscriptor} (= mismo que el alta).
  const item: ItemCola = {
    id: idGenerator.uuid(),
    tipo: 'SUSCRIPTOR',
    payload: suscriptorActualizado,
    hashLocal: hasher.sha256(JSON.stringify(suscriptorActualizado)),
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    ultimoIntentoEn: null,
    creadoEn: new Date(),
    forzarSobrescribir: true,
  };
  await colaRepo.guardar(item);

  return { suscriptorActualizado, idItemCola: item.id };
}
