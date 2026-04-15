import { EntradaCalculo, ResultadoCalculo } from './types.js';

/**
 * Motor de liquidación tarifaria CRA
 * Calcula el total a facturar a partir de lecturas y parámetros tarifarios
 */
export function calcularLiquidacion(entrada: EntradaCalculo): ResultadoCalculo {
  if (entrada.lecturaActual < entrada.lecturaAnterior) {
    throw new Error('Lectura actual no puede ser menor que la anterior');
  }

  const consumo = entrada.lecturaActual - entrada.lecturaAnterior;
  const cargoFijo = entrada.parametros.cargoFijo;
  const cargoConsumo = consumo * entrada.parametros.precioM3;
  const total = cargoFijo + cargoConsumo;

  return { consumo, cargoFijo, cargoConsumo, total };
}
