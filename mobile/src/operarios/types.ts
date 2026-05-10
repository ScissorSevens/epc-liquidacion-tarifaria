/**
 * Tipos de dominio para Operario — app móvil.
 *
 * Subconjunto del modelo backend: password_hash NO se almacena en mobile
 * por razones de seguridad. El campo `dispositivo_id` es opcional porque
 * puede no estar vinculado aún.
 */

export interface Operario {
  id_operario: number;
  numero_cedula: string;
  nombre: string;
  email: string;
  rol: 'operario' | 'admin' | string;
  estado: 'activo' | 'inactivo' | string;
  dispositivo_id?: string;
  created_at?: string;
}
