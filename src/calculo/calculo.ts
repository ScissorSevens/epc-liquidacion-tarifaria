/**
 * Módulo CALCULO — Liquidaciones inmutables
 */

import { randomUUID, createHash } from 'crypto';
import type { Liquidacion, CrearLiquidacionInput, ContenidoHasheable } from './types';

/**
 * Congela recursivamente un objeto y todos sus objetos anidados.
 * Necesario porque Object.freeze() es shallow por defecto.
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
 * Calcula el hash SHA-256 del contenido de una liquidación.
 * Reproducible: mismo contenido → mismo hash.
 * Permite detectar manipulación de datos en la base de datos.
 */
export function calcularHash(contenido: ContenidoHasheable): string {
  // Serialización determinística — el orden de las claves importa para reproducibilidad
  const payload = JSON.stringify({
    id: contenido.id,
    suscriptorId: contenido.suscriptorId,
    fechaGeneracion: contenido.fechaGeneracion.toISOString(),
    resultado: contenido.resultado,
  });

  return createHash('sha256').update(payload).digest('hex');
}

export function crearLiquidacion(input: CrearLiquidacionInput): Liquidacion {
  const resultadoClonado = JSON.parse(JSON.stringify(input.resultado));

  const id = randomUUID();
  const fechaGeneracion = new Date();

  const hash = calcularHash({
    id,
    suscriptorId: input.suscriptorId,
    fechaGeneracion,
    resultado: resultadoClonado,
  });

  const liquidacion: Liquidacion = {
    id,
    suscriptorId: input.suscriptorId,
    fechaGeneracion,
    resultado: resultadoClonado,
    hash,
  };

  return deepFreeze(liquidacion);
}
