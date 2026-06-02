/**
 * Tipos del módulo MEDIDORES — aggregate del dispositivo físico de medición.
 */

export type EstadoMedidor = 'activo' | 'inactivo' | 'reemplazado';

export interface Medidor {
  readonly id_medidor: number;
  readonly numero_medidor: string;
  readonly id_suscriptor: number;
  readonly fecha_instalacion: string;
  readonly estado: EstadoMedidor;
  readonly observaciones?: string;
  readonly created_at: string;
}

export type MedidorBorrador = Omit<Medidor, 'id_medidor' | 'created_at'>;

export type CrearMedidorInput = Omit<
  Medidor,
  'id_medidor' | 'created_at' | 'estado'
> & {
  estado?: EstadoMedidor;
};

export type ActualizarMedidorInput = Partial<Pick<Medidor, 'estado' | 'observaciones'>>;

/**
 * Puerto del repositorio. Contrato de tipos — implementación SQLite en Iter 7.
 */
export interface MedidorRepository {
  crear(data: MedidorBorrador): Promise<Medidor>;
  buscarPorId(id: number): Promise<Medidor | null>;
  /**
   * Devuelve el medidor con `numero_medidor` dado o `null` si no existe.
   * Util para el flujo de importacion CSV (politica skip-on-duplicate).
   */
  buscarPorNumero(numero: string): Promise<Medidor | null>;
  /**
   * Devuelve true si existe un medidor con el `numero_medidor` dado.
   * Util para validacion previa antes de crear.
   */
  existePorNumero(numero: string): Promise<boolean>;
  /**
   * Lista los medidores asociados a un suscriptor (ordenados por
   * `numero_medidor` ascendente). Devuelve [] si el suscriptor no
   * tiene medidores o no existe.
   */
  listarPorSuscriptor(idSuscriptor: number): Promise<Medidor[]>;
  listar(): Promise<Medidor[]>;
  actualizar(id: number, cambios: ActualizarMedidorInput): Promise<Medidor>;
  eliminar(id: number): Promise<void>;
}

/**
 * Catálogo de mensajes de error del módulo. Tests y código importan de la misma fuente
 * para impedir mistypes. Se agregan claves en cada ciclo TDD.
 */
export const MENSAJES_ERROR_MEDIDOR = {
  NUMERO_INVALIDO: 'numero_medidor solo admite letras, dígitos y guiones (1-50 caracteres)',
  ID_SUSCRIPTOR_INVALIDO: 'id_suscriptor debe ser un entero positivo',
  FECHA_FORMATO: 'fecha_instalacion debe ser ISO 8601 (YYYY-MM-DD)',
  FECHA_FUTURA: 'fecha_instalacion no puede ser futura',
  ESTADO_INVALIDO: "estado debe ser 'activo', 'inactivo' o 'reemplazado'",
  OBSERVACIONES_LARGA: 'observaciones no puede superar 500 caracteres',
} as const;
