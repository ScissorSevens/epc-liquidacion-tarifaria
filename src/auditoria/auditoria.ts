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

export type RazonInvalidez =
  | 'PRIMER_EVENTO_HASH_ANTERIOR_NO_NULO'
  | 'CADENA_ROTA'
  | 'HASH_INVALIDO';

export type ResultadoVerificacion =
  | { valida: true }
  | { valida: false; razon: RazonInvalidez; indice: number };

/**
 * Verifica la integridad de una cadena de eventos:
 * 1. El primer evento debe tener hashAnterior = null
 * 2. Cada evento posterior debe tener hashAnterior === hash del evento previo
 * 3. El hash de cada evento debe coincidir con el contenido recalculado
 *
 * Detecta: borrados, reordenamientos, manipulaciones de contenido.
 */
export function verificarCadena(eventos: EventoAuditoria[]): ResultadoVerificacion {
  if (eventos.length === 0) {
    return { valida: true };
  }

  for (let i = 0; i < eventos.length; i++) {
    const evento = eventos[i];

    // Validación de eslabón anterior
    if (i === 0) {
      if (evento.hashAnterior !== null) {
        return { valida: false, razon: 'PRIMER_EVENTO_HASH_ANTERIOR_NO_NULO', indice: 0 };
      }
    } else {
      const hashEsperado = eventos[i - 1].hash;
      if (evento.hashAnterior !== hashEsperado) {
        return { valida: false, razon: 'CADENA_ROTA', indice: i };
      }
    }

    // Validación de hash propio (detecta manipulación de contenido)
    const hashRecalculado = calcularHash({
      id: evento.id,
      timestamp: evento.timestamp,
      actor: evento.actor,
      tipo: evento.tipo,
      payload: evento.payload,
      hashAnterior: evento.hashAnterior,
    });

    if (hashRecalculado !== evento.hash) {
      return { valida: false, razon: 'HASH_INVALIDO', indice: i };
    }
  }

  return { valida: true };
}
