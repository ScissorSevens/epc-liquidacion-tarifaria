/**
 * Cola de sincronización offline.
 * Gestiona items que esperan ser enviados al backend.
 */

import { randomUUID } from 'crypto';
import type { ItemCola, AgregarItemInput } from './types';

export function agregarItemACola(input: AgregarItemInput): ItemCola {
  const item: ItemCola = {
    id: randomUUID(),
    tipo: input.tipo,
    payload: input.payload,
    hashLocal: input.hashLocal,
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    creadoEn: new Date(),
    dependeDe: input.dependeDe,
  };

  return Object.freeze(item);
}
