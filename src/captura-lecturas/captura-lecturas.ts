import { EntradaLectura, Lectura } from './types.js';

/** Regex para formato YYYYMM con mes válido (01-12) */
const PERIODO_REGEX = /^\d{4}(0[1-9]|1[0-2])$/;

/**
 * Valida que los datos de entrada de una lectura sean coherentes
 * @throws Error si algún dato es inválido
 */
function validarEntrada(entrada: EntradaLectura): void {
  if (entrada.id_medidor <= 0) {
    throw new Error('id_medidor debe ser mayor a cero');
  }

  if (entrada.id_operario <= 0) {
    throw new Error('id_operario debe ser mayor a cero');
  }

  if (!PERIODO_REGEX.test(entrada.id_periodo)) {
    throw new Error('id_periodo debe tener formato YYYYMM');
  }

  if (entrada.lectura_anterior < 0 || entrada.lectura_actual < 0) {
    throw new Error('Las lecturas no pueden ser negativas');
  }

  if (entrada.lectura_actual < entrada.lectura_anterior) {
    throw new Error('Lectura actual no puede ser menor que la anterior');
  }

  if (entrada.observaciones !== undefined && entrada.observaciones.length > 300) {
    throw new Error('Observaciones no pueden exceder 300 caracteres');
  }
}

/**
 * Registra una lectura de medidor capturada en campo
 * Retorna un objeto Lectura con estado pendiente
 */
export function registrarLectura(entrada: EntradaLectura): Lectura {
  validarEntrada(entrada);

  return {
    id_medidor: entrada.id_medidor,
    id_periodo: entrada.id_periodo,
    id_operario: entrada.id_operario,
    lectura_actual: entrada.lectura_actual,
    lectura_anterior: entrada.lectura_anterior,
    evidencia: entrada.evidencia,
    estado_validacion: 'pendiente',
    observaciones: entrada.observaciones,
    timestamp_captura: new Date().toISOString(),
    estado_sync: 'pendiente',
  };
}
