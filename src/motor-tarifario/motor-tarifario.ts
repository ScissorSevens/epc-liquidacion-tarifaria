import { EntradaCalculo, ResultadoCalculo } from './types.js';

/**
 * Valida que los datos de entrada sean coherentes
 * @throws Error si algún dato es inválido
 */
function validarEntrada(entrada: EntradaCalculo): void {
  if (entrada.lecturaAnterior < 0 || entrada.lecturaActual < 0) {
    throw new Error('Las lecturas no pueden ser negativas');
  }

  if (entrada.lecturaActual < entrada.lecturaAnterior) {
    throw new Error('Lectura actual no puede ser menor que la anterior');
  }

  if (entrada.parametros.cargoFijo < 0) {
    throw new Error('El cargo fijo no puede ser negativo');
  }

  if (entrada.parametros.precioM3 <= 0) {
    throw new Error('El precio por m3 debe ser mayor a cero');
  }
}

/**
 * Motor de liquidación tarifaria CRA
 * Calcula el total a facturar a partir de lecturas y parámetros tarifarios
 */
export function calcularLiquidacion(entrada: EntradaCalculo): ResultadoCalculo {
  validarEntrada(entrada);

  const consumo = entrada.lecturaActual - entrada.lecturaAnterior;
  const cargoFijo = entrada.parametros.cargoFijo;
  const cargoConsumo = consumo * entrada.parametros.precioM3;
  const total = cargoFijo + cargoConsumo;

  return { consumo, cargoFijo, cargoConsumo, total };
}
