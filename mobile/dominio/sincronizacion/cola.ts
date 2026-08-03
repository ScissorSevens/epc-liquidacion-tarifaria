/**
 * Cola de sincronización offline.
 * Gestiona items que esperan ser enviados al backend.
 *
 * Pure-domain: no importa `crypto`. El id se obtiene del `IdGenerator`
 * inyectado (port en `src/shared/ports/id-generator.ts`).
 */

import type { ItemCola, AgregarItemInput } from './types';
import type { IdGenerator } from '../shared/ports';

export function agregarItemACola(
  input: AgregarItemInput,
  idGenerator: IdGenerator,
): ItemCola {
  const item: ItemCola = {
    id: idGenerator.uuid(),
    tipo: input.tipo,
    payload: input.payload,
    hashLocal: input.hashLocal,
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    ultimoIntentoEn: null,
    creadoEn: new Date(),
    dependeDe: input.dependeDe,
  };

  return Object.freeze(item);
}
