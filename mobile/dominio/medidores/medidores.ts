/**
 * Módulo MEDIDORES — aggregate del dispositivo físico de medición.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_MEDIDOR.X)`.
 */

import type { CrearMedidorInput, EstadoMedidor, MedidorBorrador } from './types';
import { MENSAJES_ERROR_MEDIDOR } from './types';

const REGEX_NUMERO_MEDIDOR = /^[A-Za-z0-9-]{1,50}$/;
const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_VALIDOS: ReadonlySet<EstadoMedidor> = new Set([
  'activo',
  'inactivo',
  'reemplazado',
]);

interface CrearMedidorDeps {
  now?: () => Date;
}

function validarEntrada(input: CrearMedidorInput, now: () => Date): void {
  if (!REGEX_NUMERO_MEDIDOR.test(input.numero_medidor)) {
    throw new Error(MENSAJES_ERROR_MEDIDOR.NUMERO_INVALIDO);
  }
  if (
    !Number.isInteger(input.id_suscriptor) ||
    input.id_suscriptor < 1
  ) {
    throw new Error(MENSAJES_ERROR_MEDIDOR.ID_SUSCRIPTOR_INVALIDO);
  }
  if (!REGEX_FECHA_ISO.test(input.fecha_instalacion)) {
    throw new Error(MENSAJES_ERROR_MEDIDOR.FECHA_FORMATO);
  }
  const hoyIso = now().toISOString().slice(0, 10);
  if (input.fecha_instalacion > hoyIso) {
    throw new Error(MENSAJES_ERROR_MEDIDOR.FECHA_FUTURA);
  }
  if (input.estado !== undefined && !ESTADOS_VALIDOS.has(input.estado)) {
    throw new Error(MENSAJES_ERROR_MEDIDOR.ESTADO_INVALIDO);
  }
  if (input.observaciones !== undefined && input.observaciones.length > 500) {
    throw new Error(MENSAJES_ERROR_MEDIDOR.OBSERVACIONES_LARGA);
  }
}

export function crearMedidor(
  input: CrearMedidorInput,
  deps: CrearMedidorDeps = {},
): MedidorBorrador {
  const now = deps.now ?? (() => new Date());
  validarEntrada(input, now);

  return {
    numero_medidor: input.numero_medidor,
    id_suscriptor: input.id_suscriptor,
    fecha_instalacion: input.fecha_instalacion,
    estado: input.estado ?? 'activo',
    observaciones: input.observaciones,
  };
}
