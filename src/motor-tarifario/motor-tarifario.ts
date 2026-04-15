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

  if (entrada.parametros.precioM3Excedente <= 0) {
    throw new Error('El precio excedente debe ser mayor a cero');
  }

  if (entrada.parametros.consumoBasico <= 0) {
    throw new Error('El consumo basico debe ser mayor a cero');
  }
}

/**
 * Motor de liquidación tarifaria CRA
 * Calcula el total a facturar a partir de lecturas y parámetros tarifarios
 */
export function calcularLiquidacion(entrada: EntradaCalculo): ResultadoCalculo {
  validarEntrada(entrada);

  const consumo = entrada.lecturaActual - entrada.lecturaAnterior;
  const { cargoFijo, precioM3, precioM3Excedente, consumoBasico: limiteBasico } = entrada.parametros;

  const consumoBasico = Math.min(consumo, limiteBasico);
  const consumoExcedente = Math.max(consumo - limiteBasico, 0);

  const cargoConsumo = consumoBasico * precioM3;
  const cargoExcedente = consumoExcedente * precioM3Excedente;
  const total = cargoFijo + cargoConsumo + cargoExcedente;

  return { consumo, consumoBasico, consumoExcedente, cargoFijo, cargoConsumo, cargoExcedente, total };
}
