/**
 * Módulo CALCULO — Liquidaciones inmutables
 */

import { randomUUID } from 'crypto';
import type { Liquidacion, CrearLiquidacionInput } from './types';

export function crearLiquidacion(input: CrearLiquidacionInput): Liquidacion {
  return {
    id: randomUUID(),
    suscriptorId: input.suscriptorId,
    fechaGeneracion: new Date(),
    resultado: input.resultado,
  };
}
