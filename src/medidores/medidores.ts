/**
 * Módulo MEDIDORES — aggregate del dispositivo físico de medición.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_MEDIDOR.X)`.
 */

import type { CrearMedidorInput, MedidorBorrador } from './types';
import { MENSAJES_ERROR_MEDIDOR } from './types';

const REGEX_NUMERO_MEDIDOR = /^[A-Za-z0-9-]{1,50}$/;

function validarEntrada(input: CrearMedidorInput): void {
  if (!REGEX_NUMERO_MEDIDOR.test(input.numero_medidor)) {
    throw new Error(MENSAJES_ERROR_MEDIDOR.NUMERO_INVALIDO);
  }
}

export function crearMedidor(input: CrearMedidorInput): MedidorBorrador {
  validarEntrada(input);

  return {
    numero_medidor: input.numero_medidor,
    id_suscriptor: input.id_suscriptor,
    fecha_instalacion: input.fecha_instalacion,
    estado: input.estado ?? 'activo',
    observaciones: input.observaciones,
  };
}
