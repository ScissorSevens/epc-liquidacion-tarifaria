/**
 * Módulo SUSCRIPTORES — aggregate raíz del modelo de clientes.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_SUSCRIPTOR.X)`.
 */

import type { CrearSuscriptorInput, SuscriptorBorrador } from './types';
import { MENSAJES_ERROR_SUSCRIPTOR } from './types';

const REGEX_CODIGO = /^\d{1,10}$/;

function validarEntrada(input: CrearSuscriptorInput): void {
  if (!REGEX_CODIGO.test(input.codigo)) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.CODIGO_INVALIDO);
  }
}

export function crearSuscriptor(input: CrearSuscriptorInput): SuscriptorBorrador {
  validarEntrada(input);

  return {
    codigo: input.codigo,
    nombre_apellidos: input.nombre_apellidos,
    direccion: input.direccion,
    estrato: input.estrato,
    matricula_inmobiliaria: input.matricula_inmobiliaria,
    numero_catastral: input.numero_catastral,
    estado: input.estado ?? 'activo',
  };
}
