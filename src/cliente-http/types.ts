/**
 * Tipos del cliente HTTP de sincronización.
 * Implementa la interface ClienteSincronizacion del módulo sincronizacion.
 */

import type { TipoItem } from '../sincronizacion/types';

/**
 * Provee el token JWT para autenticación.
 * Inyectable: en tests se mockea, en RN lee de AsyncStorage, en Node lee de env.
 */
export interface TokenProvider {
  obtenerToken(): Promise<string | null>;
}

export interface ConfiguracionCliente {
  /** URL base del backend, ej: 'https://api.epc.com' */
  baseUrl: string;
  /** Provee el JWT para el header Authorization */
  tokenProvider: TokenProvider;
}

/**
 * Mapea cada TipoItem a su endpoint REST.
 * El cliente postea a `${baseUrl}${RUTAS_POR_TIPO[tipo]}`.
 */
export const RUTAS_POR_TIPO: Record<TipoItem, string> = {
  LIQUIDACION: '/api/liquidaciones',
  LECTURA: '/api/lecturas',
  EVIDENCIA: '/api/evidencias',
  EVENTO_AUDITORIA: '/api/auditoria',
};
