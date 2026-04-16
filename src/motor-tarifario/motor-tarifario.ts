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

  if (entrada.estrato !== undefined && !(entrada.estrato >= 1 && entrada.estrato <= 6)) {
    throw new Error('Estrato debe ser un valor entre 1 y 6');
  }

  if (entrada.periodo !== undefined) {
    if (!(entrada.periodo.mes >= 1 && entrada.periodo.mes <= 12)) {
      throw new Error('Mes debe ser un valor entre 1 y 12');
    }
    if (entrada.periodo.anio < 2000) {
      throw new Error('Anio debe ser mayor o igual a 2000');
    }
  }
}

/**
 * Motor de liquidación tarifaria CRA
 * Calcula el total a facturar a partir de lecturas y parámetros tarifarios
 */
export function calcularLiquidacion(entrada: EntradaCalculo): ResultadoCalculo {
  validarEntrada(entrada);

  const consumo = entrada.lecturaActual - entrada.lecturaAnterior;
  const { cargoFijo: cargoFijoRaw, precioM3, precioM3Excedente, consumoBasico: limiteBasico } = entrada.parametros;

  const consumoBasico = Math.min(consumo, limiteBasico);
  const consumoExcedente = Math.max(consumo - limiteBasico, 0);

  const cargoFijo = Math.round(cargoFijoRaw);
  const cargoConsumo = Math.round(consumoBasico * precioM3);
  const cargoExcedente = Math.round(consumoExcedente * precioM3Excedente);

  // Subsidio/contribución por estrato (CRA Res. 688/2014)
  // Subsidio: aplica sobre cargo fijo + cargo consumo básico
  // Contribución: aplica sobre cargo fijo + cargo consumo total (básico + excedente)
  const factor = entrada.estrato ? FACTOR_ESTRATO[entrada.estrato] : 0;
  const cargoConsumoTotal = cargoConsumo + cargoExcedente;
  const baseSubsidio = cargoFijo + cargoConsumo;
  const baseContribucion = cargoFijo + cargoConsumoTotal;
  const subsidio = Math.round(factor < 0 ? Math.abs(factor) * baseSubsidio : 0);
  const contribucion = Math.round(factor > 0 ? factor * baseContribucion : 0);

  const total = cargoFijo + cargoConsumoTotal - subsidio + contribucion;

  return { consumo, consumoBasico, consumoExcedente, cargoFijo, cargoConsumo, cargoExcedente, subsidio, contribucion, total, periodo: entrada.periodo };
}

/**
 * Liquidación batch — procesa múltiples suscriptores
 * Si una entrada tiene error, captura el error y sigue con las demás
 */
export function calcularBatch(entradas: EntradaCalculo[]): ResultadoCalculo[] {
  return entradas.map((entrada) => {
    try {
      return calcularLiquidacion(entrada);
    } catch (err) {
      return {
        consumo: 0, consumoBasico: 0, consumoExcedente: 0,
        cargoFijo: 0, cargoConsumo: 0, cargoExcedente: 0,
        subsidio: 0, contribucion: 0, total: 0,
        error: (err as Error).message,
      };
    }
  });
}
