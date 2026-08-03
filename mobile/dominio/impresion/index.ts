/**
 * Fachada publica del modulo `dominio/impresion/`. Reexporta tipos y
 * helpers para que callers importen desde un unico path:
 *
 *   import { armarTicketEscPos, ANCHO_POR_PAPEL } from '@dominio/impresion';
 */

export {
  armarTicketEscPos,
  envolverLinea,
  centrarLinea,
  padRight,
  normalizarParaImpresora,
  formatearFechaCorta,
  formatearMontoCorto,
} from './esc-pos';
export {
  ANCHO_POR_PAPEL,
  MAPA_CARACTERES,
  PREFERENCIAS_IMPRESION_DEFAULT,
  ExcepcionImpresora,
} from './types';
export type {
  AnchoPapel,
  TransporteImpresora,
  Impresora,
  EstadoImpresora,
  CapacidadImpresora,
  ImpresoraTermica,
  PreferenciasImpresion,
  ErrorImpresion,
} from './types';
