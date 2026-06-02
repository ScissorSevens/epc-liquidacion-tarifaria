/**
 * Módulo CALCULO — Liquidaciones inmutables
 *
 * Hexagonal: el dominio NO depende del módulo `crypto` de Node. Recibe
 * `Hasher` e `IdGenerator` por inyección para que el bundle Metro de
 * React Native pueda resolverlos vía adapters universales (`js-sha256`,
 * `uuid` con polyfill `react-native-get-random-values`).
 */

import type { Liquidacion, CrearLiquidacionInput, ContenidoHasheable } from './types';
import type { ResultadoCalculo } from '../motor-tarifario';
import type { Hasher, IdGenerator } from '../shared/ports';

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
 * Reproducible: mismo contenido + mismo Hasher → mismo hash.
 * Permite detectar manipulación de datos en la base de datos.
 */
export function calcularHash(contenido: ContenidoHasheable, hasher: Hasher): string {
  // Serialización determinística — el orden de las claves importa para reproducibilidad
  const payload = JSON.stringify({
    id: contenido.id,
    suscriptorId: contenido.suscriptorId,
    fechaGeneracion: contenido.fechaGeneracion.toISOString(),
    resultado: contenido.resultado,
    estado: contenido.estado,
    reemplazaA: contenido.reemplazaA ?? null,
  });

  return hasher.sha256(payload);
}

export function crearLiquidacion(
  input: CrearLiquidacionInput,
  hasher: Hasher,
  idGenerator: IdGenerator,
): Liquidacion {
  const resultadoClonado = JSON.parse(JSON.stringify(input.resultado));

  const id = idGenerator.uuid();
  const fechaGeneracion = new Date();
  const estado = 'ACTIVA' as const;

  const hash = calcularHash({
    id,
    suscriptorId: input.suscriptorId,
    fechaGeneracion,
    resultado: resultadoClonado,
    estado,
  }, hasher);

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
export function verificarIntegridad(liquidacion: Liquidacion, hasher: Hasher): boolean {
  const hashEsperado = calcularHash({
    id: liquidacion.id,
    suscriptorId: liquidacion.suscriptorId,
    fechaGeneracion: liquidacion.fechaGeneracion,
    resultado: liquidacion.resultado,
    estado: liquidacion.estado,
    reemplazaA: liquidacion.reemplazaA,
  }, hasher);

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
  resultadoCorregido: ResultadoCalculo,
  hasher: Hasher,
  idGenerator: IdGenerator,
): { anulada: Liquidacion; nueva: Liquidacion } {
  // Validación 1: integridad — no operamos sobre datos corruptos
  if (!verificarIntegridad(original, hasher)) {
    throw new Error(
      `No se puede anular: integridad rota en liquidación ${original.id} (hash no coincide, posible tampering)`
    );
  }

  // Validación 2: estado — no se puede anular dos veces
  if (original.estado === 'ANULADA') {
    throw new Error(
      `Estado inválido: la liquidación ${original.id} ya está ANULADA`
    );
  }

  // Construimos la versión ANULADA de la original (mismo contenido, estado cambiado, hash recalculado)
  const resultadoOriginalClonado = JSON.parse(JSON.stringify(original.resultado));

  const hashAnulada = calcularHash({
    id: original.id,
    suscriptorId: original.suscriptorId,
    fechaGeneracion: original.fechaGeneracion,
    resultado: resultadoOriginalClonado,
    estado: 'ANULADA',
    reemplazaA: original.reemplazaA,
  }, hasher);

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
  const idNuevo = idGenerator.uuid();
  const fechaNueva = new Date();

  const hashNueva = calcularHash({
    id: idNuevo,
    suscriptorId: original.suscriptorId,
    fechaGeneracion: fechaNueva,
    resultado: resultadoNuevoClonado,
    estado: 'ACTIVA',
    reemplazaA: original.id,
  }, hasher);

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
