/**
 * Módulo OPERARIOS — aggregate del personal del sistema.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_OPERARIO.X)`.
 * El dominio NO hashea passwords: recibe `password_hash` ya calculado.
 */

import type {
  CrearOperarioInput,
  EstadoOperario,
  OperarioBorrador,
  RolOperario,
} from './types';
import { MENSAJES_ERROR_OPERARIO } from './types';

const REGEX_CEDULA = /^\d{6,12}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_VALIDOS: ReadonlySet<RolOperario> = new Set([
  'operario',
  'supervisor',
  'admin',
]);
const ESTADOS_VALIDOS: ReadonlySet<EstadoOperario> = new Set([
  'activo',
  'inactivo',
]);

function validarEntrada(input: CrearOperarioInput): void {
  if (!REGEX_CEDULA.test(input.numero_cedula)) {
    throw new Error(MENSAJES_ERROR_OPERARIO.CEDULA_INVALIDA);
  }
  if (input.nombre === '') {
    throw new Error(MENSAJES_ERROR_OPERARIO.NOMBRE_VACIO);
  }
  if (input.nombre.length > 150) {
    throw new Error(MENSAJES_ERROR_OPERARIO.NOMBRE_LARGO);
  }
  if (!REGEX_EMAIL.test(input.email)) {
    throw new Error(MENSAJES_ERROR_OPERARIO.EMAIL_INVALIDO);
  }
  if (input.password_hash === '') {
    throw new Error(MENSAJES_ERROR_OPERARIO.PASSWORD_HASH_VACIO);
  }
  if (input.id_prestador <= 0) {
    throw new Error(MENSAJES_ERROR_OPERARIO.ID_PRESTADOR_INVALIDO);
  }
  if (input.rol !== undefined && !ROLES_VALIDOS.has(input.rol)) {
    throw new Error(MENSAJES_ERROR_OPERARIO.ROL_INVALIDO);
  }
  if (input.estado !== undefined && !ESTADOS_VALIDOS.has(input.estado)) {
    throw new Error(MENSAJES_ERROR_OPERARIO.ESTADO_INVALIDO);
  }
  if (
    input.dispositivo_id !== undefined &&
    input.dispositivo_id.length > 100
  ) {
    throw new Error(MENSAJES_ERROR_OPERARIO.DISPOSITIVO_LARGO);
  }
}

export function crearOperario(input: CrearOperarioInput): OperarioBorrador {
  validarEntrada(input);

  return {
    id_prestador: input.id_prestador,
    numero_cedula: input.numero_cedula,
    nombre: input.nombre,
    email: input.email,
    password_hash: input.password_hash,
    rol: input.rol ?? 'operario',
    estado: input.estado ?? 'activo',
    dispositivo_id: input.dispositivo_id,
  };
}
