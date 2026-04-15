import { EntradaCalculo, ResultadoCalculo } from './types.js';

/**
 * Motor de liquidación tarifaria CRA
 * Calcula el total a facturar a partir de lecturas y parámetros tarifarios
 */
export function calcularLiquidacion(entrada: EntradaCalculo): ResultadoCalculo {
  const consumo = entrada.lecturaActual - entrada.lecturaAnterior;
  const cargoFijo = entrada.parametros.cargoFijo;
  const cargoConsumo = consumo * entrada.parametros.precioM3;
  const total = cargoFijo + cargoConsumo;

  return { consumo, cargoFijo, cargoConsumo, total };
}
