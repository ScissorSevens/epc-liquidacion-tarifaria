/**
 * Tipos del módulo OPERARIOS — aggregate del personal del sistema.
 */

export type EstadoOperario = 'activo' | 'inactivo';
export type RolOperario = 'operario' | 'supervisor' | 'admin';

export interface Operario {
  readonly id_operario: number;
  readonly numero_cedula: string;
  readonly nombre: string;
  readonly email: string;
  readonly password_hash: string;
  readonly rol: RolOperario;
  readonly estado: EstadoOperario;
  readonly dispositivo_id?: string;
  readonly created_at: string;
}

export type OperarioBorrador = Omit<Operario, 'id_operario' | 'created_at'>;

export type CrearOperarioInput = Omit<
  Operario,
  'id_operario' | 'created_at' | 'rol' | 'estado'
> & {
  rol?: RolOperario;
  estado?: EstadoOperario;
};

export type ActualizarOperarioInput = Partial<
  Pick<Operario, 'estado' | 'rol' | 'dispositivo_id' | 'password_hash'>
>;

/**
 * Puerto del repositorio. Contrato de tipos — implementación SQLite en Iter 7.
 */
export interface OperarioRepository {
  crear(data: OperarioBorrador): Promise<Operario>;
  buscarPorId(id: number): Promise<Operario | null>;
  listar(): Promise<Operario[]>;
  actualizar(id: number, cambios: ActualizarOperarioInput): Promise<Operario>;
  eliminar(id: number): Promise<void>;
}

/**
 * Catálogo de mensajes de error del módulo. Tests y código importan de la misma fuente
 * para impedir mistypes. Se agregan claves en cada ciclo TDD.
 */
export const MENSAJES_ERROR_OPERARIO = {
  CEDULA_INVALIDA: 'numero_cedula debe tener entre 6 y 12 dígitos',
  EMAIL_INVALIDO: 'email tiene formato inválido',
  PASSWORD_HASH_VACIO: 'password_hash no puede estar vacío',
  ROL_INVALIDO: "rol debe ser 'operario', 'supervisor' o 'admin'",
} as const;
