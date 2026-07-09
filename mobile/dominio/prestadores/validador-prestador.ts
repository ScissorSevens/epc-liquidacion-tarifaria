/**
 * Validador y factory del módulo PRESTADORES — reglas multi-tenant.
 *
 * El módulo expone:
 *   - `cedulaRepresentanteLegalValida` — regla pura `boolean` (Fase 2.1).
 *   - `crearPrestador` — factory que valida TODAS las reglas de creación
 *     y devuelve un `PrestadorBorrador` listo para persistir.
 *
 * Las funciones puras `boolean` se usan desde la UI para feedback inline
 * sin acoplar a strings de dominio. La factory, en cambio, encapsula el
 * "shape correcto" de un prestador nuevo y centraliza el catálogo de
 * errores `MENSAJES_ERROR_PRESTADOR` (mirror del patrón de
 * `dominio/operarios/operarios.ts` → `crearOperario`).
 */

import type { CrearPrestadorInput, PrestadorBorrador } from './types';
import { MENSAJES_ERROR_PRESTADOR } from './types';

const REGEX_CEDULA_COLOMBIA = /^\d{6,12}$/;
const REGEX_CODIGO = /^\d{1,50}$/;
const LONGITUD_NOMBRE_MAXIMA = 200;
const LONGITUD_NIT_MAXIMA = 20;
const LONGITUD_MUNICIPIO_MAXIMA = 100;
const LONGITUD_DEPARTAMENTO_MAXIMA = 100;

/**
 * Valida la cédula del representante legal del prestador.
 *
 * Acepta exclusivamente cadenas de dígitos entre 6 y 12 caracteres. No
 * admite separadores (puntos, guiones, espacios) ni letras; la regla
 * busca el formato canónico colombiano que se almacena en la columna
 * `representante_legal_cedula` agregada por migration 016.
 *
 * @param cedula cadena cruda del input del usuario.
 * @returns `true` si cumple el formato, `false` en cualquier otro caso
 *          (incluye string vacío, `undefined` no convertible, longitudes
 *          fuera de [6, 12], separadores o caracteres no numéricos).
 */
export function cedulaRepresentanteLegalValida(cedula: string): boolean {
  return REGEX_CEDULA_COLOMBIA.test(cedula);
}

/**
 * Valida todas las reglas de creación de un prestador.
 *
 * Lanza `Error` con la clave de `MENSAJES_ERROR_PRESTADOR` que corresponda
 * a la primera violación encontrada. El orden de las comprobaciones es
 * estable para que los tests (y la UI) puedan anticipar el mensaje.
 *
 * Reglas:
 *   - codigo: 1-50 dígitos (`/^\d{1,50}$/`).
 *   - nombre: 1-200 caracteres.
 *   - nit: 1-20 caracteres (chequeo de formato queda fuera del MVP rural).
 *   - representante_legal: no vacío.
 *   - representante_legal_cedula: 6-12 dígitos (reusa el validador
 *     `cedulaRepresentanteLegalValida` de Fase 2.1).
 *   - municipio: 1-100 caracteres.
 *   - departamento: 1-100 caracteres.
 *   - segmento: estrictamente 1 o 2.
 *   - num_suscriptores_urbanos / rurales: enteros ≥ 0.
 */
function validarEntrada(input: CrearPrestadorInput): void {
  if (!REGEX_CODIGO.test(input.codigo)) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.CODIGO_VACIO);
  }
  if (input.nombre.length === 0) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.NOMBRE_VACIO);
  }
  if (input.nombre.length > LONGITUD_NOMBRE_MAXIMA) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.NOMBRE_LARGO);
  }
  if (input.nit.length === 0) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.NIT_VACIO);
  }
  if (input.nit.length > LONGITUD_NIT_MAXIMA) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.NIT_LARGO);
  }
  if (input.representante_legal.length === 0) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.REPRESENTANTE_LEGAL_VACIO);
  }
  if (!cedulaRepresentanteLegalValida(input.representante_legal_cedula)) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.CEDULA_REP_LEGAL_INVALIDA);
  }
  if (input.municipio.length === 0) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.MUNICIPIO_VACIO);
  }
  if (input.municipio.length > LONGITUD_MUNICIPIO_MAXIMA) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.MUNICIPIO_LARGO);
  }
  if (input.departamento.length === 0) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.DEPARTAMENTO_VACIO);
  }
  if (input.departamento.length > LONGITUD_DEPARTAMENTO_MAXIMA) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.DEPARTAMENTO_LARGO);
  }
  if (input.segmento !== 1 && input.segmento !== 2) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.SEGMENTO_INVALIDO);
  }
  if (input.num_suscriptores_urbanos < 0) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.NUM_URBANOS_NEGATIVO);
  }
  if (input.num_suscriptores_rurales < 0) {
    throw new Error(MENSAJES_ERROR_PRESTADOR.NUM_RURALES_NEGATIVO);
  }
}

/**
 * Crea un `PrestadorBorrador` a partir de un `CrearPrestadorInput`,
 * aplicando defaults (`estado = 'activo'`, `contacto = null`) si el
 * caller los omitió y validando el resto de las reglas de negocio.
 *
 * No aplica unicidad de `codigo` ni persistencia: esa es responsabilidad
 * del repositorio SQLite (que ya consulta la regla `existePorCodigo`
 * antes de delegar acá).
 *
 * @throws `Error` con `MENSAJES_ERROR_PRESTADOR.X` ante la primera
 *         violación de las reglas enumeradas en `validarEntrada`.
 */
export function crearPrestador(input: CrearPrestadorInput): PrestadorBorrador {
  validarEntrada(input);

  return {
    codigo: input.codigo,
    nombre: input.nombre,
    nit: input.nit,
    representante_legal: input.representante_legal,
    representante_legal_cedula: input.representante_legal_cedula,
    municipio: input.municipio,
    departamento: input.departamento,
    segmento: input.segmento,
    num_suscriptores_urbanos: input.num_suscriptores_urbanos,
    num_suscriptores_rurales: input.num_suscriptores_rurales,
    contacto: input.contacto ?? null,
    estado: input.estado ?? 'activo',
  };
}

