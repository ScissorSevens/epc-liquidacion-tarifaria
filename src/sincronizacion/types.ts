/**
 * Tipos del módulo SINCRONIZACION
 * Cola offline para enviar items al backend cuando hay conexión
 */

export type TipoItem = 'LIQUIDACION' | 'LECTURA' | 'EVIDENCIA' | 'EVENTO_AUDITORIA';

export type EstadoItem =
  | 'PENDIENTE'    // Esperando ser enviado
  | 'ENVIANDO'     // En proceso de envío
  | 'EXITOSO'      // Confirmado por el server
  | 'CONFLICTO'    // Server respondió 409 con hash distinto
  | 'FALLIDO';     // Superó el límite de reintentos

export interface ItemCola {
  readonly id: string;
  readonly tipo: TipoItem;
  readonly payload: unknown;
  readonly hashLocal: string;
  readonly estado: EstadoItem;
  readonly intentos: number;
  readonly ultimoError: string | null;
  readonly ultimoIntentoEn: Date | null;
  readonly creadoEn: Date;
  readonly dependeDe?: readonly string[];
}

export interface AgregarItemInput {
  tipo: TipoItem;
  payload: unknown;
  hashLocal: string;
  dependeDe?: readonly string[];
}
