/**
 * Módulo SUSCRIPTORES — aggregate raíz del modelo de clientes.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_SUSCRIPTOR.X)`.
 */

import type { CrearSuscriptorInput, EstadoSuscriptor, SuscriptorBorrador } from './types';
import { MENSAJES_ERROR_SUSCRIPTOR } from './types';

const REGEX_CODIGO = /^\d{1,10}$/;
const REGEX_CEDULA = /^\d{6,12}$/;
const ESTADOS_VALIDOS: ReadonlySet<EstadoSuscriptor> = new Set([
  'activo',
  'inactivo',
  'suspendido',
]);

function validarEntrada(
  input: CrearSuscriptorInput,
  nombreTrimmed: string,
  cedula: string,
  municipio: string,
): void {
  if (!REGEX_CODIGO.test(input.codigo)) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.CODIGO_INVALIDO);
  }
  if (nombreTrimmed.length === 0) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.NOMBRE_VACIO);
  }
  if (nombreTrimmed.length > 150) {
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
  if (cedula.length === 0) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.CEDULA_VACIA);
  }
  if (!REGEX_CEDULA.test(cedula)) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.CEDULA_INVALIDA);
  }
  if (municipio.length === 0) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.MUNICIPIO_VACIO);
  }
  if (municipio.length > 100) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.MUNICIPIO_LARGO);
  }
  if (input.sector !== undefined && input.sector.length > 100) {
    throw new Error(MENSAJES_ERROR_SUSCRIPTOR.SECTOR_LARGO);
  }
}

/**
 * Crea un SuscriptorBorrador propagando los campos multi-tenant
 * (id_prestador, categoria_uso). Si el caller no los provee, asume los
 * defaults legacy (id_prestador=0, categoria_uso='residencial') para
 * mantener compatibilidad con datos anteriores al change
 * motor-tarifario-cra-825-2017-multitenant.
 *
 * Aplica `trim` a `nombre_apellidos`, `cedula` y `municipio` antes de
 * validar y antes de propagar, de modo que el SuscriptorBorrador NUNCA
 * persiste con espacios al inicio/final.
 */
export function crearSuscriptor(input: CrearSuscriptorInput): SuscriptorBorrador {
  const nombreTrimmed = input.nombre_apellidos.trim();
  const cedula = input.cedula.trim();
  const municipio = input.municipio.trim();
  validarEntrada(input, nombreTrimmed, cedula, municipio);

  return {
    codigo: input.codigo,
    nombre_apellidos: nombreTrimmed,
    cedula,
    municipio,
    ...(input.sector !== undefined && { sector: input.sector }),
    direccion: input.direccion,
    estrato: input.estrato,
    matricula_inmobiliaria: input.matricula_inmobiliaria,
    numero_catastral: input.numero_catastral,
    aplica_subsidio: input.aplica_subsidio,
    estado: input.estado ?? 'activo',
    id_prestador: input.id_prestador ?? 0,
    categoria_uso: input.categoria_uso ?? 'residencial',
  };
}
