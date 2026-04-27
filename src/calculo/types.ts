/**
 * Tipos del módulo CALCULO
 * Liquidaciones inmutables con trazabilidad para auditoría CRA
 */

import type { ResultadoCalculo } from '../motor-tarifario';

export type EstadoLiquidacion = 'ACTIVA' | 'ANULADA';

export interface Liquidacion {
  readonly id: string;
  readonly suscriptorId: string;
  readonly fechaGeneracion: Date;
  readonly resultado: ResultadoCalculo;
  readonly estado: EstadoLiquidacion;
  readonly reemplazaA?: string; // ID de la liquidación que esta anula/reemplaza
  readonly hash: string;
}

export interface ContenidoHasheable {
  id: string;
  suscriptorId: string;
  fechaGeneracion: Date;
  resultado: ResultadoCalculo;
  estado: EstadoLiquidacion;
  reemplazaA?: string;
}

export interface CrearLiquidacionInput {
  suscriptorId: string;
  resultado: ResultadoCalculo;
}
