/**
 * Módulo PERIODOS — aggregate del período de facturación mensual.
 *
 * Funciones puras. Errores como `throw new Error(MENSAJES_ERROR_PERIODO.X)`.
 */

import type { CrearPeriodoInput, PeriodoBorrador } from './types';
import { MENSAJES_ERROR_PERIODO, PERIODO_REGEX } from './types';

const ANIO_MIN = 2000;
const ANIO_MAX = 2099;

function esIdPeriodoValido(id: string): boolean {
  if (!PERIODO_REGEX.test(id)) return false;
  const anio = Number.parseInt(id.slice(0, 4), 10);
  return anio >= ANIO_MIN && anio <= ANIO_MAX;
}

function validarEntrada(input: CrearPeriodoInput): void {
  if (!esIdPeriodoValido(input.id_periodo)) {
    throw new Error(MENSAJES_ERROR_PERIODO.ID_PERIODO_INVALIDO);
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
