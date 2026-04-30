/**
 * Módulo PERIODOS — aggregate del período de facturación mensual.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_PERIODO.X)`.
 */

import type { CrearPeriodoInput, EstadoPeriodo, PeriodoBorrador } from './types';
import { MENSAJES_ERROR_PERIODO, PERIODO_REGEX } from './types';

const ANIO_MIN = 2000;
const ANIO_MAX = 2099;
const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_VALIDOS: ReadonlySet<EstadoPeriodo> = new Set([
  'abierto',
  'cerrado',
  'facturado',
]);

function esIdPeriodoValido(id: string): boolean {
  if (!PERIODO_REGEX.test(id)) return false;
  const anio = Number.parseInt(id.slice(0, 4), 10);
  return anio >= ANIO_MIN && anio <= ANIO_MAX;
}

function validarEntrada(input: CrearPeriodoInput): void {
  if (!esIdPeriodoValido(input.id_periodo)) {
    throw new Error(MENSAJES_ERROR_PERIODO.ID_PERIODO_INVALIDO);
  }
  if (!REGEX_FECHA_ISO.test(input.fecha_inicio)) {
    throw new Error(MENSAJES_ERROR_PERIODO.FECHA_INICIO_FORMATO);
  }
  if (!REGEX_FECHA_ISO.test(input.fecha_fin)) {
    throw new Error(MENSAJES_ERROR_PERIODO.FECHA_FIN_FORMATO);
  }
  if (input.fecha_fin <= input.fecha_inicio) {
    throw new Error(MENSAJES_ERROR_PERIODO.FECHA_FIN_ORDEN);
  }
  if (!REGEX_FECHA_ISO.test(input.fecha_pago_sin_recargo)) {
    throw new Error(MENSAJES_ERROR_PERIODO.PAGO_SIN_RECARGO_FORMATO);
  }
  if (input.fecha_pago_sin_recargo < input.fecha_fin) {
    throw new Error(MENSAJES_ERROR_PERIODO.PAGO_SIN_RECARGO_ORDEN);
  }
  if (!REGEX_FECHA_ISO.test(input.fecha_pago_con_recargo)) {
    throw new Error(MENSAJES_ERROR_PERIODO.PAGO_CON_RECARGO_FORMATO);
  }
  if (input.fecha_pago_con_recargo <= input.fecha_pago_sin_recargo) {
    throw new Error(MENSAJES_ERROR_PERIODO.PAGO_CON_RECARGO_ORDEN);
  }
  if (input.nombre.length === 0) {
    throw new Error(MENSAJES_ERROR_PERIODO.NOMBRE_VACIO);
  }
  if (input.nombre.length > 20) {
    throw new Error(MENSAJES_ERROR_PERIODO.NOMBRE_LARGO);
  }
  if (
    input.dias_consumo !== undefined &&
    (!Number.isInteger(input.dias_consumo) || input.dias_consumo < 1)
  ) {
    throw new Error(MENSAJES_ERROR_PERIODO.DIAS_CONSUMO_INVALIDO);
  }
  if (input.estado !== undefined && !ESTADOS_VALIDOS.has(input.estado)) {
    throw new Error(MENSAJES_ERROR_PERIODO.ESTADO_INVALIDO);
  }
}

export function crearPeriodo(input: CrearPeriodoInput): PeriodoBorrador {
  validarEntrada(input);

  return {
    id_periodo: input.id_periodo,
    nombre: input.nombre,
    fecha_inicio: input.fecha_inicio,
    fecha_fin: input.fecha_fin,
    fecha_pago_sin_recargo: input.fecha_pago_sin_recargo,
    fecha_pago_con_recargo: input.fecha_pago_con_recargo,
    dias_consumo: input.dias_consumo,
    estado: input.estado ?? 'abierto',
  };
}
