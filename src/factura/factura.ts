/**
 * Módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Funciones puras (excepto orquestadores que reciben repo). Errores como
 * `throw new Error(MENSAJES_ERROR_FACTURA.X)`. deepFreeze garantiza
 * inmutabilidad recursiva.
 */

import type { EmitirFacturaInput, Factura } from './types';

function formatearNumeroFactura(dispositivoId: string, consecutivo: number): string {
  return `${dispositivoId}-${consecutivo}`;
}

export function emitirFactura(input: EmitirFacturaInput): Factura {
  const numero_factura = formatearNumeroFactura(
    input.operario.dispositivo_id ?? '',
    input.consecutivo,
  );
  return {
    id: '',
    numero_factura,
    estado: 'BORRADOR',
    fecha_emision: '',
    snapshot: {
      suscriptor: { codigo: '', nombre_apellidos: '', direccion: '', estrato: 1 },
      medidor: { numero_medidor: '' },
      periodo: {
        id_periodo: '',
        fecha_inicio: '',
        fecha_fin: '',
        fecha_pago_sin_recargo: '',
        fecha_pago_con_recargo: '',
        dias_consumo: 0,
      },
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
