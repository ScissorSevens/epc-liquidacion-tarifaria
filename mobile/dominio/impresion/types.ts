/**
 * Tipos del dominio `impresion` — puerto puro `ImpresoraTermica` y
 * shapes asociados (preferencias, errores tipados, capacidades).
 *
 * NO se importa React Native ni libs nativas. El dominio es testeable
 * sin device fisico, sin permisos, sin Bluetooth encendido.
 *
 * Spec referencia: `factura-impresion-termica`, `factura-preview-ticket`,
 * `impresora-perfil-preferences`.
 */

import type { Factura } from '../factura/types';

export type AnchoPapel = '58mm' | '80mm';

export type TransporteImpresora = 'BLE' | 'SPP';

export interface Impresora {
  readonly id: string;
  readonly nombre: string;
  readonly transporte: TransporteImpresora;
  readonly direccion: string;
  readonly anchoPapel: AnchoPapel;
  readonly rssi?: number;
  readonly estado: 'emparejada' | 'disponible' | 'error';
}

export type EstadoImpresora =
  | 'desconocido'
  | 'escaneando'
  | 'lista'
  | 'conectando'
  | 'conectada'
  | 'error';

export interface CapacidadImpresora {
  readonly soportaCorte: boolean;
  readonly soportaCodigoBarras: boolean;
  readonly soportaDobleAncho: boolean;
  readonly anchoMaximo: 32 | 42;
  readonly codePage: 'PC437' | 'PC850' | 'CP1252';
}

/** Puerto: contrato uniforme para cualquier transporte Bluetooth. */
export interface ImpresoraTermica {
  readonly id: string;
  readonly transporte: TransporteImpresora;

  escanear(timeoutMs: number): Promise<readonly Impresora[]>;
  emparejar(impresora: Impresora): Promise<void>;
  conectar(direccion: string): Promise<void>;
  imprimir(payload: string[]): Promise<void>;
  obtenerCapacidades(): Promise<CapacidadImpresora>;
  desconectar(): Promise<void>;
  estado(): EstadoImpresora;
}

export interface PreferenciasImpresion {
  readonly version: 1;
  readonly ultima_impresora: {
    readonly id: string;
    readonly nombre: string;
    readonly transporte: TransporteImpresora;
    readonly direccion: string;
    readonly anchoPapel: AnchoPapel;
  } | null;
  readonly papel_default: AnchoPapel;
}

export const PREFERENCIAS_IMPRESION_DEFAULT: PreferenciasImpresion = Object.freeze({
  version: 1,
  ultima_impresora: null,
  papel_default: '58mm',
});

export type ErrorImpresion =
  | { codigo: 'PERMISO_DENEGADO'; transporte: TransporteImpresora; mensaje: string }
  | { codigo: 'CONEXION_FALLIDA'; direccion: string; mensaje: string; cause?: unknown }
  | { codigo: 'IMPRESORA_OCUPADA'; direccion: string; mensaje: string }
  | { codigo: 'TIMEOUT'; operacion: string; mensaje: string }
  | { codigo: 'NO_ENCONTRADA'; direccion: string; mensaje: string }
  | { codigo: 'DESCONOCIDO'; mensaje: string; cause?: unknown };

export class ExcepcionImpresora extends Error {
  readonly codigo: ErrorImpresion['codigo'];
  readonly causa?: unknown;
  constructor(error: ErrorImpresion) {
    super(error.mensaje);
    this.name = 'ExcepcionImpresora';
    this.codigo = error.codigo;
    if ('cause' in error) {
      this.causa = (error as { cause?: unknown }).cause;
    }
  }
}

/**
 * Mapa de caracteres no-PC437 a su forma ASCII. Las termicas economicas
 * usan PC437 (EEUU) por default; tildes, eñe y diacriticos caen al
 * fallback ASCII legible en vez de salir como `?` ilegible.
 */
export const MAPA_CARACTERES: Readonly<Record<string, string>> = Object.freeze({
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
  'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
  'ñ': 'n', 'Ñ': 'N',
  'ü': 'u', 'Ü': 'U',
  '¿': '?', '¡': '!',
  '“': '"', '”': '"', '‘': "'", '’': "'",
  '—': '-', '–': '-',
});

export const ANCHO_POR_PAPEL: Readonly<Record<AnchoPapel, number>> = Object.freeze({
  '58mm': 32,
  '80mm': 42,
});

export type { Factura };
