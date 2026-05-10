/**
 * Módulo SUSCRIPTORES — aggregate raíz del modelo de clientes.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_SUSCRIPTOR.X)`.
 */

import type { CrearSuscriptorInput, EstadoSuscriptor, SuscriptorBorrador } from './types';
import { MENSAJES_ERROR_SUSCRIPTOR } from './types';

const REGEX_CODIGO = /^\d{1,10}$/;
const ESTADOS_VALIDOS: ReadonlySet<EstadoSuscriptor> = new Set([
  'activo',
  'inactivo',
  'suspendido',
]);

function validarEntrada(input: CrearSuscriptorInput): void {
  if (!REGEX_CODIGO.test(input.codigo)) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.CODIGO_INVALIDO);
  }
  if (input.nombre_apellidos.length === 0) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.NOMBRE_VACIO);
  }
  if (input.nombre_apellidos.length > 150) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.NOMBRE_LARGO);
  }
  if (input.direccion.length === 0) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.DIRECCION_VACIA);
  }
  if (input.direccion.length > 200) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.DIRECCION_LARGA);
  }
  if (
    !Number.isInteger(input.estrato) ||
    input.estrato < 1 ||
    input.estrato > 6
  ) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.ESTRATO_FUERA_RANGO);
  }
  if (
    input.matricula_inmobiliaria !== undefined &&
    input.matricula_inmobiliaria.length > 50
  ) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.MATRICULA_LARGA);
  }
  if (
    input.numero_catastral !== undefined &&
    input.numero_catastral.length > 50
  ) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.CATASTRAL_LARGA);
  }
  if (input.estado !== undefined && !ESTADOS_VALIDOS.has(input.estado)) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.ESTADO_INVALIDO);
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
    aplica_subsidio: input.aplica_subsidio,
    estado: input.estado ?? 'activo',
  };
}
