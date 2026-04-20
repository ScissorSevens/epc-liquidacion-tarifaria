/**
 * Tipos del módulo de captura de lecturas
 * Basado en entidad LECTURA del Diccionario de Datos v1.0
 */

/** Estados de validación de una lectura */
export type EstadoValidacion = 'pendiente' | 'validado' | 'error';

/** Estados de sincronización con backend */
export type EstadoSync = 'pendiente' | 'sincronizado' | 'error';

/** Evidencia fotográfica del medidor */
export interface EvidenciaFoto {
  foto_path: string;          // Ruta local de la fotografía
  foto_hash?: string;         // SHA-256 de la imagen para validar integridad
}

/** Entrada para registrar una lectura en campo */
export interface EntradaLectura {
  id_medidor: number;             // FK a MEDIDOR
  id_periodo: string;             // FK a PERIODO (formato YYYYMM)
  id_operario: number;            // FK a OPERARIO (quien captura)
  lectura_actual: number;         // Valor del medidor en m³
  lectura_anterior: number;       // Valor anterior (del sistema o migración inicial)
  evidencia?: EvidenciaFoto;      // Foto del medidor (opcional en captura, requerida en validación)
  observaciones?: string;         // Notas del técnico (max 300 chars)
}

/** Lectura registrada en el sistema */
export interface Lectura {
  id_lectura?: number;            // PK autoincremental (undefined hasta persistir)
  id_medidor: number;
  id_periodo: string;
  id_operario: number;
  lectura_actual: number;
  lectura_anterior: number;
  evidencia?: EvidenciaFoto;
  estado_validacion: EstadoValidacion;
  observaciones?: string;
  timestamp_captura: string;      // ISO-8601
  timestamp_sync?: string;        // ISO-8601, cuando se sincroniza
  estado_sync: EstadoSync;
}
