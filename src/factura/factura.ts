/**
 * Módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Funciones puras (excepto orquestadores que reciben repo). Errores como
 * `throw new Error(MENSAJES_ERROR_FACTURA.X)`. deepFreeze garantiza
 * inmutabilidad recursiva.
 */

import type { EmitirFacturaInput, Factura } from './types';

/**
 * Congela recursivamente. Replicado de calculo.ts (3er duplicado pendiente
 * para extracción a shared — YAGNI hasta entonces).
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

function formatearNumeroFactura(dispositivoId: string, consecutivo: number): string {
  return `${dispositivoId}-${consecutivo}`;
}

export function emitirFactura(input: EmitirFacturaInput): Factura {
  const numero_factura = formatearNumeroFactura(
    input.operario.dispositivo_id ?? '',
    input.consecutivo,
  );
  const suscriptorSnapshot = deepFreeze({
    codigo: input.suscriptor.codigo,
    nombre_apellidos: input.suscriptor.nombre_apellidos,
    direccion: input.suscriptor.direccion,
    estrato: input.suscriptor.estrato,
  });
  const medidorSnapshot = deepFreeze({
    numero_medidor: input.medidor.numero_medidor,
  });
  const periodoSnapshot = deepFreeze({
    id_periodo: input.periodo.id_periodo,
    fecha_inicio: input.periodo.fecha_inicio,
    fecha_fin: input.periodo.fecha_fin,
    fecha_pago_sin_recargo: input.periodo.fecha_pago_sin_recargo,
    fecha_pago_con_recargo: input.periodo.fecha_pago_con_recargo,
    dias_consumo: input.periodo.dias_consumo ?? 0,
  });
  return {
    id: '',
    numero_factura,
    estado: 'BORRADOR',
    fecha_emision: '',
    snapshot: {
      suscriptor: suscriptorSnapshot,
      medidor: medidorSnapshot,
      periodo: periodoSnapshot,
      operario: { id_operario: 0, nombre: '', dispositivo_id: '' },
      liquidacion: {
        id: '',
        hash: '',
        resultado: {
          consumo: 0,
          consumoBasico: 0,
          consumoExcedente: 0,
          cargoFijo: 0,
          cargoConsumo: 0,
          cargoExcedente: 0,
          subsidio: 0,
          contribucion: 0,
          total: 0,
        },
      },
      consumosHistoricos: [],
    },
    hash: '',
    created_at: '',
  };
}
