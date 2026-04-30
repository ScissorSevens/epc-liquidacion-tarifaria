/**
 * Módulo OPERARIOS — aggregate del personal del sistema.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_OPERARIO.X)`.
 * El dominio NO hashea passwords: recibe `password_hash` ya calculado.
 */

import type { CrearOperarioInput, OperarioBorrador, RolOperario } from './types';
import { MENSAJES_ERROR_OPERARIO } from './types';

const REGEX_CEDULA = /^\d{6,12}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_VALIDOS: ReadonlySet<RolOperario> = new Set([
  'operario',
  'supervisor',
  'admin',
]);

function validarEntrada(input: CrearOperarioInput): void {
  if (!REGEX_CEDULA.test(input.numero_cedula)) {
    throw new Error(MENSAJES_ERROR_OPERARIO.CEDULA_INVALIDA);
  }
  if (!REGEX_EMAIL.test(input.email)) {
    throw new Error(MENSAJES_ERROR_OPERARIO.EMAIL_INVALIDO);
  }
  if (input.password_hash === '') {
    throw new Error(MENSAJES_ERROR_OPERARIO.PASSWORD_HASH_VACIO);
  }
  if (input.rol !== undefined && !ROLES_VALIDOS.has(input.rol)) {
    throw new Error(MENSAJES_ERROR_OPERARIO.ROL_INVALIDO);
  }
}

export function crearOperario(input: CrearOperarioInput): OperarioBorrador {
  validarEntrada(input);

  return {
    numero_cedula: input.numero_cedula,
    nombre: input.nombre,
    email: input.email,
    password_hash: input.password_hash,
    rol: input.rol ?? 'operario',
    estado: input.estado ?? 'activo',
    dispositivo_id: input.dispositivo_id,
  };
}
