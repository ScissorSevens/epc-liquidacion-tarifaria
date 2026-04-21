/**
 * Tipos del módulo CALCULO
 * Liquidaciones inmutables con trazabilidad para auditoría CRA
 */

import type { ResultadoCalculo } from '../motor-tarifario';

export interface Liquidacion {
  readonly id: string;
  readonly suscriptorId: string;
  readonly fechaGeneracion: Date;
  readonly resultado: ResultadoCalculo;
}

export interface CrearLiquidacionInput {
  suscriptorId: string;
  resultado: ResultadoCalculo;
}
