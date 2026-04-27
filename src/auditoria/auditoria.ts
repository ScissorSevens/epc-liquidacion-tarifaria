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
  const id = randomUUID();
  const timestamp = new Date();
  const hashAnterior = input.hashAnterior ?? null;

  const hash = calcularHash({
    id,
    timestamp,
    actor: input.actor,
    tipo: input.tipo,
    payload: input.payload,
    hashAnterior,
  });

  return {
    id,
    timestamp,
    actor: input.actor,
    tipo: input.tipo,
    payload: input.payload,
    hashAnterior,
    hash,
  };
}
