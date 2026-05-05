/**
 * Parametros tarifarios DEMO para la entrega academica.
 *
 * Estos valores son hardcoded y representan una tarifa razonable de un
 * EPC pequeno rural en Colombia ano 2025. NO son oficiales: vinieron de
 * referencias publicas de tarifas CRA y se usan solo para demostrar el
 * flujo de captura -> calculo en la app movil.
 *
 * En produccion estos parametros deben venir de una pantalla de
 * administracion (configuracion por periodo, por estrato y por tipo de
 * uso). Eso queda como TRABAJO FUTURO fuera del alcance de la entrega
 * academica del 13 de mayo de 2026.
 *
 * Significado de cada campo (ver `src/motor-tarifario/types.ts`):
 *  - cargoFijo: cobro mensual fijo en pesos colombianos.
 *  - precioM3: precio por m3 mientras el consumo esta dentro del basico.
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
