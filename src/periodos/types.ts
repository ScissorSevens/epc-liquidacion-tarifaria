/**
 * Tipos del módulo PERIODOS — aggregate del período de facturación mensual.
 */

/**
 * Regex base para id_periodo en formato YYYYMM con mes válido (01-12).
 * Single source of truth — `captura-lecturas` también la consume.
 * La validación semántica de rango de año vive en la factory `crearPeriodo`.
 */
export const PERIODO_REGEX = /^\d{4}(0[1-9]|1[0-2])$/;

export type EstadoPeriodo = 'abierto' | 'cerrado' | 'facturado';

export interface Periodo {
  readonly id_periodo: string;
  readonly nombre: string;
  readonly fecha_inicio: string;
  readonly fecha_fin: string;
  readonly fecha_pago_sin_recargo: string;
  readonly fecha_pago_con_recargo: string;
  readonly dias_consumo?: number;
  readonly estado: EstadoPeriodo;
  readonly created_at: string;
}

/**
 * Borrador devuelto por la factory: aún sin `created_at`.
 * `id_periodo` SÍ está presente porque es input del usuario (PK no autoincremental).
 */
export type PeriodoBorrador = Omit<Periodo, 'created_at'>;

export type CrearPeriodoInput = Omit<Periodo, 'created_at' | 'estado'> & {
  estado?: EstadoPeriodo;
};

export type ActualizarPeriodoInput = Partial<
  Pick<Periodo, 'estado' | 'fecha_pago_sin_recargo' | 'fecha_pago_con_recargo' | 'dias_consumo'>
>;

/**
 * Puerto del repositorio. Contrato de tipos — implementación SQLite en Iter 7.
 * `eliminar` es soft-delete: setea `estado := 'cerrado'`.
 */
export interface PeriodoRepository {
  crear(data: PeriodoBorrador): Promise<Periodo>;
  buscarPorId(id: string): Promise<Periodo | null>;
  listar(): Promise<Periodo[]>;
  actualizar(id: string, cambios: ActualizarPeriodoInput): Promise<Periodo>;
  eliminar(id: string): Promise<void>;
}

/**
 * Catálogo de mensajes de error del módulo. Se completa por ciclo TDD.
 */
export const MENSAJES_ERROR_PERIODO = {
  ID_PERIODO_INVALIDO: 'id_periodo debe tener formato YYYYMM (año 2000-2099, mes 01-12)',
} as const;
