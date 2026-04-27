/**
 * Módulo CALCULO — Liquidaciones inmutables
 */

import { randomUUID, createHash } from 'crypto';
import type { Liquidacion, CrearLiquidacionInput, ContenidoHasheable } from './types';
import type { ResultadoCalculo } from '../motor-tarifario';

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
    estado: contenido.estado,
    reemplazaA: contenido.reemplazaA ?? null,
  });

  return createHash('sha256').update(payload).digest('hex');
}

export function crearLiquidacion(input: CrearLiquidacionInput): Liquidacion {
  const resultadoClonado = JSON.parse(JSON.stringify(input.resultado));

  const id = randomUUID();
  const fechaGeneracion = new Date();
  const estado = 'ACTIVA' as const;

  const hash = calcularHash({
    id,
    suscriptorId: input.suscriptorId,
    fechaGeneracion,
    resultado: resultadoClonado,
    estado,
  });

  const liquidacion: Liquidacion = {
    id,
    suscriptorId: input.suscriptorId,
    fechaGeneracion,
    resultado: resultadoClonado,
    estado,
    hash,
  };

  return deepFreeze(liquidacion);
}

/**
 * Verifica la integridad de una Liquidación recalculando su hash
 * y comparándolo con el hash almacenado.
 * Retorna false si el contenido fue manipulado.
 */
export function verificarIntegridad(liquidacion: Liquidacion): boolean {
  const hashEsperado = calcularHash({
    id: liquidacion.id,
    suscriptorId: liquidacion.suscriptorId,
    fechaGeneracion: liquidacion.fechaGeneracion,
    resultado: liquidacion.resultado,
    estado: liquidacion.estado,
    reemplazaA: liquidacion.reemplazaA,
  });

  return hashEsperado === liquidacion.hash;
}

/**
 * Anula una liquidación existente y crea una nueva en su reemplazo.
 * Retorna ambas: la anulada (mismo id, estado ANULADA, hash recalculado)
 * y la nueva (id nuevo, estado ACTIVA, reemplazaA = id original).
 *
 * No muta la liquidación original — retorna nuevas instancias congeladas.
 */
export function anularYReemplazar(
  original: Liquidacion,
  resultadoCorregido: ResultadoCalculo
): { anulada: Liquidacion; nueva: Liquidacion } {
  // Construimos la versión ANULADA de la original (mismo contenido, estado cambiado, hash recalculado)
  const resultadoOriginalClonado = JSON.parse(JSON.stringify(original.resultado));

  const hashAnulada = calcularHash({
    id: original.id,
    suscriptorId: original.suscriptorId,
    fechaGeneracion: original.fechaGeneracion,
    resultado: resultadoOriginalClonado,
    estado: 'ANULADA',
    reemplazaA: original.reemplazaA,
  });

  const anulada: Liquidacion = deepFreeze({
    id: original.id,
    suscriptorId: original.suscriptorId,
    fechaGeneracion: original.fechaGeneracion,
    resultado: resultadoOriginalClonado,
    estado: 'ANULADA' as const,
    reemplazaA: original.reemplazaA,
    hash: hashAnulada,
  });

  // Creamos la nueva liquidación que reemplaza a la original
  const resultadoNuevoClonado = JSON.parse(JSON.stringify(resultadoCorregido));
  const idNuevo = randomUUID();
  const fechaNueva = new Date();

  const hashNueva = calcularHash({
    id: idNuevo,
    suscriptorId: original.suscriptorId,
    fechaGeneracion: fechaNueva,
    resultado: resultadoNuevoClonado,
    estado: 'ACTIVA',
    reemplazaA: original.id,
  });

  const nueva: Liquidacion = deepFreeze({
    id: idNuevo,
    suscriptorId: original.suscriptorId,
    fechaGeneracion: fechaNueva,
    resultado: resultadoNuevoClonado,
    estado: 'ACTIVA' as const,
    reemplazaA: original.id,
    hash: hashNueva,
  });

  return { anulada, nueva };
}
