import { EntradaLectura, EvidenciaFoto, Lectura } from './types.js';

/** Regex para formato YYYYMM con mes válido (01-12) */
const PERIODO_REGEX = /^\d{4}(0[1-9]|1[0-2])$/;

/** Extensiones de imagen válidas para evidencia */
const EXTENSIONES_IMAGEN = /\.(jpg|jpeg|png|heic)$/i;

/** Regex para SHA-256: exactamente 64 caracteres hexadecimales */
const SHA256_REGEX = /^[a-fA-F0-9]{64}$/;

/**
 * Valida que los datos de entrada de una lectura sean coherentes
 * @throws Error si algún dato es inválido
 */
function validarEntrada(entrada: EntradaLectura): void {
  if (!Number.isInteger(entrada.id_medidor) || entrada.id_medidor <= 0) {
    throw new Error('id_medidor debe ser un entero mayor a cero');
  }

  if (!Number.isInteger(entrada.id_operario) || entrada.id_operario <= 0) {
    throw new Error('id_operario debe ser un entero mayor a cero');
  }

  if (!PERIODO_REGEX.test(entrada.id_periodo)) {
    throw new Error('id_periodo debe tener formato YYYYMM');
  }

  const anio = parseInt(entrada.id_periodo.substring(0, 4), 10);
  if (anio < 2000) {
    throw new Error('id_periodo debe tener anio mayor o igual a 2000');
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

  if (entrada.evidencia !== undefined) {
    validarEvidenciaEntrada(entrada.evidencia);
  }
}

/**
 * Valida los datos de evidencia fotográfica
 * @throws Error si la evidencia es inválida
 */
function validarEvidenciaEntrada(evidencia: EvidenciaFoto): void {
  if (!evidencia.foto_path || evidencia.foto_path.trim() === '') {
    throw new Error('foto_path no puede estar vacio');
  }

  if (!EXTENSIONES_IMAGEN.test(evidencia.foto_path)) {
    throw new Error('foto_path debe ser una imagen (.jpg, .jpeg, .png, .heic)');
  }

  if (evidencia.foto_hash !== undefined && !SHA256_REGEX.test(evidencia.foto_hash)) {
    throw new Error('foto_hash debe ser SHA-256 valido (64 caracteres hexadecimales)');
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
    observaciones: entrada.observaciones || undefined,
    timestamp_captura: new Date().toISOString(),
    estado_sync: 'pendiente',
  };
}

/**
 * Valida si una lectura tiene evidencia fotográfica completa
 * @param lectura - Lectura a validar
 * @param opciones - { requiereHash: true } para exigir integridad SHA-256
 */
export function validarEvidencia(
  lectura: Lectura,
  opciones?: { requiereHash: boolean },
): boolean {
  if (!lectura.evidencia) return false;
  if (opciones?.requiereHash && !lectura.evidencia.foto_hash) return false;
  return true;
}
