/**
 * Contrato del repositorio de lecturas
 * Repository Pattern — la lógica de negocio depende de esta interfaz,
 * NO de la implementación concreta (memoria, SQLite, API, etc.)
 */

import { Lectura } from '../captura-lecturas/types';

/** Resultado paginado para listados grandes */
export interface ResultadoPaginado<T> {
  datos: T[];
  total: number;
}

/** Filtros para buscar lecturas */
export interface FiltrosLectura {
  id_periodo?: string;
  id_medidor?: number;
  id_operario?: number;
  estado_sync?: 'pendiente' | 'sincronizado' | 'error';
  estado_validacion?: 'pendiente' | 'validado' | 'error';
}

/** Contrato que debe implementar cualquier repositorio de lecturas */
export interface LecturaRepository {
  /** Guarda una lectura y le asigna id_lectura autoincremental */
  guardar(lectura: Lectura): Promise<Lectura>;

  /** Obtiene una lectura por su id */
  obtenerPorId(id: number): Promise<Lectura | null>;

  /** Lista lecturas por periodo */
  listarPorPeriodo(idPeriodo: string): Promise<Lectura[]>;

  /** Lista lecturas pendientes de sincronización */
  listarPendientesSync(): Promise<Lectura[]>;

  /** Lista lecturas con filtros opcionales */
  listar(filtros?: FiltrosLectura): Promise<Lectura[]>;

  /** Actualiza el estado de sincronización de una lectura */
  actualizarEstadoSync(id: number, estado: 'sincronizado' | 'error', timestampSync?: string): Promise<Lectura>;

  /** Actualiza el estado de validación de una lectura */
  actualizarEstadoValidacion(id: number, estado: 'validado' | 'error'): Promise<Lectura>;

  /** Cuenta el total de lecturas (con filtros opcionales) */
  contar(filtros?: FiltrosLectura): Promise<number>;

  /** Verifica si existe lectura para un medidor en un periodo (clave única compuesta) */
  existeLectura(idMedidor: number, idPeriodo: string): Promise<boolean>;
}
