/**
 * Parametros tarifarios para la entrega academica.
 *
 * Estos valores representan una tarifa razonable de un EPC pequeno rural
 * en Colombia ano 2025. Tomados de referencias publicas de tarifas CRA,
 * se usan para demostrar el flujo captura → calculo en la app movil.
 *
 * En produccion estos parametros deben venir de una pantalla de
 * administracion (configuracion por periodo, estrato y tipo de uso).
 *
 * Significado de cada campo (ver `src/motor-tarifario/types.ts`):
 *  - cargoFijo: cobro mensual fijo en pesos colombianos.
 *  - precioM3: precio por m3 dentro del consumo basico.
 *  - precioM3Excedente: precio por m3 que exceda el consumo basico.
 *  - consumoBasico: umbral en m3 a partir del cual se cobra excedente.
 */

import type { ParametrosTarifa } from '@dominio/motor-tarifario/types';

export const PARAMETROS_TARIFARIOS_DEMO: ParametrosTarifa = {
  cargoFijo: 15000,
  precioM3: 2000,
  precioM3Excedente: 4000,
  consumoBasico: 20,
};
