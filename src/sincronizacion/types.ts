/**
 * Tipos del módulo SINCRONIZACION
 * Cola offline para enviar items al backend cuando hay conexión
 */

export type TipoItem = 'LIQUIDACION' | 'LECTURA' | 'EVIDENCIA' | 'EVENTO_AUDITORIA';

export type EstadoItem =
  | 'PENDIENTE'    // Esperando ser enviado
  | 'ENVIANDO'     // En proceso de envío
  | 'EXITOSO'      // Confirmado por el server
  | 'CONFLICTO'    // Server respondió con hash distinto — espera resolución manual
  | 'FALLIDO'      // Superó el límite de reintentos
  | 'DESCARTADO';  // El operario decidió descartar el item

export interface ItemCola {
  readonly id: string;
  readonly tipo: TipoItem;
  readonly payload: unknown;
  readonly hashLocal: string;
  readonly hashServer?: string;          // Hash que el server reportó en caso de conflicto
  readonly estado: EstadoItem;
  readonly intentos: number;
  readonly ultimoError: string | null;
  readonly ultimoIntentoEn: Date | null;
  readonly creadoEn: Date;
  readonly dependeDe?: readonly string[];
  readonly forzarSobrescribir?: boolean; // Marcado tras SOBRESCRIBIR_LOCAL
}

export type DecisionConflicto =
  | 'SOBRESCRIBIR_LOCAL'   // Mi versión gana — vuelve a PENDIENTE con flag
  | 'SOBRESCRIBIR_SERVER'  // Acepto la versión del server — marco como EXITOSO
  | 'DESCARTAR';           // Olvidalo, no lo envíes nunca

export interface AgregarItemInput {
  tipo: TipoItem;
  payload: unknown;
  hashLocal: string;
  dependeDe?: readonly string[];
}
