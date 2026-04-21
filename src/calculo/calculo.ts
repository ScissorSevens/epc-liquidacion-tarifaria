/**
 * Módulo CALCULO — Liquidaciones inmutables
 */

import { randomUUID } from 'crypto';
import type { Liquidacion, CrearLiquidacionInput } from './types';

/**
 * Congela recursivamente un objeto y todos sus objetos anidados.
 * Necesario porque Object.freeze() es shallow por defecto.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }

  // Congelamos primero las propiedades anidadas, después el objeto mismo
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

export function crearLiquidacion(input: CrearLiquidacionInput): Liquidacion {
  // Clonamos el resultado para no mutar el input del caller
  const resultadoClonado = JSON.parse(JSON.stringify(input.resultado));

  const liquidacion: Liquidacion = {
    id: randomUUID(),
    suscriptorId: input.suscriptorId,
    fechaGeneracion: new Date(),
    resultado: resultadoClonado,
  };

  return deepFreeze(liquidacion);
}
