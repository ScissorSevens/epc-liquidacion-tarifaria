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
export const MENSAJES_ERROR_SUSCRIPTOR = {} as const;
