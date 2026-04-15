import { EntradaCalculo, Estrato, ResultadoCalculo } from './types.js';

/** Porcentajes de subsidio/contribución por estrato según CRA */
const FACTOR_ESTRATO: Record<Estrato, number> = {
  1: -0.70,   // subsidio 70%
  2: -0.40,   // subsidio 40%
  3: -0.15,   // subsidio 15%
  4:  0,       // costo real
  5:  0.50,    // contribución 50%
  6:  0.60,    // contribución 60%
};

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

  // Subsidio/contribución por estrato (aplica sobre cargo de consumo total)
  const factor = entrada.estrato ? FACTOR_ESTRATO[entrada.estrato] : 0;
  const cargoConsumoTotal = cargoConsumo + cargoExcedente;
  const subsidio = factor < 0 ? Math.abs(factor) * cargoConsumoTotal : 0;
  const contribucion = factor > 0 ? factor * cargoConsumoTotal : 0;

  const total = cargoFijo + cargoConsumoTotal - subsidio + contribucion;

  return { consumo, consumoBasico, consumoExcedente, cargoFijo, cargoConsumo, cargoExcedente, subsidio, contribucion, total };
}
