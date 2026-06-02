/**
 * Tipos del módulo SUSCRIPTORES — aggregate raíz del modelo de clientes.
 */

export type EstadoSuscriptor = 'activo' | 'inactivo' | 'suspendido';

export interface Suscriptor {
  readonly id_suscriptor: number;
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly cedula: string;
  readonly municipio: string;
  readonly sector?: string;
  readonly calle?: string;
  readonly direccion: string;
  readonly estrato: 1 | 2 | 3 | 4 | 5 | 6;
  readonly matricula_inmobiliaria?: string;
  readonly numero_catastral?: string;
  readonly aplica_subsidio: boolean;
  readonly estado: EstadoSuscriptor;
  readonly created_at: string;
}

export type SuscriptorBorrador = Omit<Suscriptor, 'id_suscriptor' | 'created_at'>;

export type CrearSuscriptorInput = Omit<
  Suscriptor,
  'id_suscriptor' | 'created_at' | 'estado'
> & {
  estado?: EstadoSuscriptor;
};

export type ActualizarSuscriptorInput = Partial<
  Pick<Suscriptor, 'nombre_apellidos' | 'direccion' | 'estrato' | 'matricula_inmobiliaria' | 'numero_catastral' | 'estado' | 'cedula' | 'municipio' | 'sector' | 'calle'>
>;

/**
 * Puerto del repositorio. Contrato de tipos — implementación SQLite en Iter 7.
 */
export interface SuscriptorRepository {
  crear(data: SuscriptorBorrador): Promise<Suscriptor>;
  buscarPorId(id: number): Promise<Suscriptor | null>;
  buscarPorCodigo(codigo: string): Promise<Suscriptor | null>;
  /**
   * Devuelve true si existe un suscriptor con el `codigo` dado. Util
   * para el flujo de importacion CSV (politica skip-on-duplicate).
   */
  existePorCodigo(codigo: string): Promise<boolean>;
  /**
   * Devuelve el codigo numerico mas alto registrado, o null si no hay suscriptores.
   * Usado para auto-generar el siguiente codigo correlativo.
   */
  maxCodigo(): Promise<string | null>;
  listar(): Promise<Suscriptor[]>;
  actualizar(id: number, cambios: ActualizarSuscriptorInput): Promise<Suscriptor>;
  eliminar(id: number): Promise<void>;
}

/**
 * Catálogo de mensajes de error del módulo. Tests y código importan de la misma fuente
 * para impedir mistypes. Se agregan claves en cada ciclo TDD.
 */
export const MENSAJES_ERROR_SUSCRIPTOR = {
  CODIGO_INVALIDO: 'codigo debe tener entre 1 y 10 dígitos',
  NOMBRE_VACIO: 'nombre_apellidos no puede estar vacío',
  NOMBRE_LARGO: 'nombre_apellidos no puede superar 150 caracteres',
  DIRECCION_VACIA: 'direccion no puede estar vacía',
  DIRECCION_LARGA: 'direccion no puede superar 200 caracteres',
  ESTRATO_FUERA_RANGO: 'estrato debe ser un entero entre 1 y 6',
  MATRICULA_LARGA: 'matricula_inmobiliaria no puede superar 50 caracteres',
  CATASTRAL_LARGA: 'numero_catastral no puede superar 50 caracteres',
  ESTADO_INVALIDO: "estado debe ser 'activo', 'inactivo' o 'suspendido'",
  CEDULA_VACIA: 'cedula no puede estar vacía',
  CEDULA_INVALIDA: 'cedula debe tener entre 6 y 12 dígitos numéricos',
  MUNICIPIO_VACIO: 'municipio no puede estar vacío',
  MUNICIPIO_LARGO: 'municipio no puede superar 100 caracteres',
  SECTOR_LARGO: 'sector no puede superar 100 caracteres',
  CALLE_LARGA: 'calle no puede superar 100 caracteres',
} as const;
