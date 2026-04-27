/**
 * Módulo AUDITORIA — Eventos inmutables encadenados
 */

import { randomUUID, createHash } from 'crypto';
import type {
  EventoAuditoria,
  RegistrarEventoInput,
  ContenidoHasheable,
} from './types';

/**
 * Congela recursivamente un objeto y todos sus objetos anidados.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

/**
 * Calcula el hash SHA-256 del contenido de un evento.
 * Incluye hashAnterior — esto es lo que crea la cadena.
 */
export function calcularHash(contenido: ContenidoHasheable): string {
  const payload = JSON.stringify({
    id: contenido.id,
    timestamp: contenido.timestamp.toISOString(),
    actor: contenido.actor,
    tipo: contenido.tipo,
    payload: contenido.payload,
    hashAnterior: contenido.hashAnterior,
  });

  return createHash('sha256').update(payload).digest('hex');
}

export function registrarEvento(input: RegistrarEventoInput): EventoAuditoria {
  // Clonamos para no compartir referencias con el caller
  const actorClonado = JSON.parse(JSON.stringify(input.actor));
  const payloadClonado = JSON.parse(JSON.stringify(input.payload));

  const id = randomUUID();
  const timestamp = new Date();
  const hashAnterior = input.hashAnterior ?? null;

  const hash = calcularHash({
    id,
    timestamp,
    actor: actorClonado,
    tipo: input.tipo,
    payload: payloadClonado,
    hashAnterior,
  });

  const evento: EventoAuditoria = {
    id,
    timestamp,
    actor: actorClonado,
    tipo: input.tipo,
    payload: payloadClonado,
    hashAnterior,
    hash,
  };

  return deepFreeze(evento);
}
