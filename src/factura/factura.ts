/**
 * Módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Funciones puras (excepto orquestadores que reciben repo). Errores como
 * `throw new Error(MENSAJES_ERROR_FACTURA.X)`. deepFreeze garantiza
 * inmutabilidad recursiva.
 */

import { createHash } from 'crypto';
import { verificarIntegridad } from '../calculo/calculo';
import { MENSAJES_ERROR_FACTURA, type EmitirFacturaInput, type Factura, type FacturaSnapshot } from './types';

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

/**
 * Hash SHA-256 reproducible sobre snapshot canónico + numero_factura + fecha_emision.
 * Serialización determinística — orden de claves explícito (D1).
 */
function calcularHashFactura(
  snapshot: FacturaSnapshot,
  numeroFactura: string,
  fechaEmision: string,
): string {
  const payload = JSON.stringify({
    numero_factura: numeroFactura,
    fecha_emision: fechaEmision,
    snapshot: {
      suscriptor: snapshot.suscriptor,
      medidor: snapshot.medidor,
      periodo: snapshot.periodo,
      operario: snapshot.operario,
      liquidacion: snapshot.liquidacion,
      consumosHistoricos: snapshot.consumosHistoricos,
      observaciones: snapshot.observaciones ?? null,
    },
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function emitirFactura(input: EmitirFacturaInput): Factura {
  if (!verificarIntegridad(input.liquidacion)) {
    throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_INTEGRIDAD_ROTA);
  }
  if (input.liquidacion.estado !== 'ACTIVA') {
    throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_NO_ACTIVA);
  }
  if (input.suscriptor.estado !== 'activo') {
    throw new Error(MENSAJES_ERROR_FACTURA.SUSCRIPTOR_NO_ACTIVO);
  }
  if (input.medidor.id_suscriptor !== input.suscriptor.id_suscriptor) {
    throw new Error(MENSAJES_ERROR_FACTURA.MEDIDOR_NO_PERTENECE_A_SUSCRIPTOR);
  }
  if (input.medidor.estado !== 'activo') {
    throw new Error(MENSAJES_ERROR_FACTURA.MEDIDOR_NO_ACTIVO);
  }
  if (input.periodo.estado !== 'cerrado' && input.periodo.estado !== 'facturado') {
    throw new Error(MENSAJES_ERROR_FACTURA.PERIODO_NO_FACTURABLE);
  }
  if (input.fechaEmision < input.periodo.fecha_fin) {
    throw new Error(MENSAJES_ERROR_FACTURA.FECHA_EMISION_ANTES_FIN_PERIODO);
  }
  if (input.operario.estado !== 'activo') {
    throw new Error(MENSAJES_ERROR_FACTURA.OPERARIO_NO_ACTIVO);
  }
  if (!input.operario.dispositivo_id) {
    throw new Error(MENSAJES_ERROR_FACTURA.OPERARIO_SIN_DISPOSITIVO);
  }
  if (input.consumosHistoricos.length > 6) {
    throw new Error(MENSAJES_ERROR_FACTURA.CONSUMO_HISTORICO_INVALIDO);
  }
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
  const operarioSnapshot = deepFreeze({
    id_operario: input.operario.id_operario,
    nombre: input.operario.nombre,
    dispositivo_id: input.operario.dispositivo_id ?? '',
  });
  const liquidacionSnapshot = deepFreeze({
    id: input.liquidacion.id,
    hash: input.liquidacion.hash,
    resultado: { ...input.liquidacion.resultado },
  });
  const consumosHistoricosSnapshot = deepFreeze(
    input.consumosHistoricos.map((c) => ({
      id_periodo: c.id_periodo,
      consumo_m3: c.consumo_m3,
      total_facturado: c.total_facturado,
    })),
  );
  const snapshot: FacturaSnapshot = {
    suscriptor: suscriptorSnapshot,
    medidor: medidorSnapshot,
    periodo: periodoSnapshot,
    operario: operarioSnapshot,
    liquidacion: liquidacionSnapshot,
    consumosHistoricos: consumosHistoricosSnapshot,
    ...(input.observaciones !== undefined && { observaciones: input.observaciones }),
  };
  const hash = calcularHashFactura(snapshot, numero_factura, input.fechaEmision);
  return deepFreeze({
    id: '',
    numero_factura,
    estado: 'BORRADOR',
    fecha_emision: input.fechaEmision,
    snapshot,
    hash,
    created_at: '',
  });
}

/**
 * Anula una Factura EMITIDA. Función pura — devuelve copia congelada con
 * estado ANULADA, motivo y fecha de anulación. Mismo id y numero_factura.
 *
 * El tercer arg `fechaAnulacion` es ISO 8601 (YYYY-MM-DD).
 * Validar transición: solo desde EMITIDA (BORRADOR/PAGADA/ANULADA rechazan).
 */
export function anularFactura(
  factura: Factura,
  motivo: string,
  fechaAnulacion: string,
): Factura {
  if (factura.estado !== 'EMITIDA') {
    throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL);
  }
  return deepFreeze({
    ...factura,
    estado: 'ANULADA',
    motivo_anulacion: motivo,
    fecha_anulacion: fechaAnulacion,
  });
}
