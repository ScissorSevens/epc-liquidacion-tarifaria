/**
 * Tipos del módulo SUSCRIPTORES — aggregate raíz del modelo de clientes.
 */

export type EstadoSuscriptor = 'activo' | 'inactivo' | 'suspendido';

export interface Suscriptor {
  readonly id_suscriptor: number;
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly direccion: string;
  readonly estrato: 1 | 2 | 3 | 4 | 5 | 6;
  readonly matricula_inmobiliaria?: string;
  readonly numero_catastral?: string;
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
} as const;
