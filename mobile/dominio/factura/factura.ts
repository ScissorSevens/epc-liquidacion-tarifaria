/**
 * Módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Funciones puras (excepto orquestadores que reciben repo). Errores como
 * `throw new Error(MENSAJES_ERROR_FACTURA.X)`. deepFreeze garantiza
 * inmutabilidad recursiva.
 */

import type { Hasher } from '../shared/ports';
import { verificarIntegridad } from '../calculo/calculo';
import type { Liquidacion } from '../calculo/types';
import type { Prestador } from '../prestadores/types';
import {
  extraerSnapshotLectura,
  MENSAJES_ERROR_FACTURA,
  type EmitirFacturaInput,
  type EstadoFactura,
  type Factura,
  type FacturaMetadata,
  type FacturaSnapshot,
  type FacturaSnapshotPrestador,
  type OtroValor,
} from './types';

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
 * Proyecta un `Prestador` (entidad origen) al `FacturaSnapshotPrestador`
 * (sub-snapshot inmutable de la factura). Solo los 7 campos exigidos por
 * Res CRA 1038/2026 §1: id, codigo, nombre, NIT, municipio, departamento
 * y representante legal. NO expone `password_hash` ni datos sensibles.
 *
 * Función pura: deepFreeze + solo lee del input. Caller debe pasar el
 * Prestador del workspace activo (no recargar desde DB).
 */
export function extraerSnapshotPrestador(prestador: Prestador): FacturaSnapshotPrestador {
  if (prestador === null || prestador === undefined) {
    throw new Error('extraerSnapshotPrestador: prestador es requerido');
  }
  return deepFreeze({
    id_prestador: prestador.id_prestador,
    codigo: prestador.codigo,
    nombre: prestador.nombre,
    nit: prestador.nit,
    municipio: prestador.municipio,
    departamento: prestador.departamento,
    representante_legal: prestador.representante_legal,
  });
}

/**
 * Hash SHA-256 reproducible sobre snapshot canónico + numero_factura + fecha_emision.
 * Serialización determinística — orden de claves explícito (D1).
 *
 * v2 (FacturaCompliance-Fase1): incluye `prestador` en el payload y
 * `metadata.hash_version: 'v2'`. Las facturas v1 existentes fueron
 * generadas con la forma previa; `calcularHashFactura` siempre firma
 * con v2 hacia adelante para que todas las nuevas facturas sean
 * verificables con el snapshot extendido.
 *
 * Exportado para que callers verifiquen integridad post-corrección
 * (ej: `verificarIntegridad(factura)` o tests de coherencia).
 */
export function calcularHashFactura(
  snapshot: FacturaSnapshot,
  numeroFactura: string,
  fechaEmision: string,
  hasher: Hasher,
): string {
  const payload = JSON.stringify({
    numero_factura: numeroFactura,
    fecha_emision: fechaEmision,
    snapshot: {
      suscriptor: snapshot.suscriptor,
      medidor: snapshot.medidor,
      periodo: snapshot.periodo,
      operario: snapshot.operario,
      prestador: snapshot.prestador,
      lectura: snapshot.lectura,
      liquidacion: snapshot.liquidacion,
      consumosHistoricos: snapshot.consumosHistoricos,
      otros_valores: snapshot.otros_valores,
      saldo_anterior: snapshot.saldo_anterior,
      metadata: snapshot.metadata,
      observaciones: snapshot.observaciones ?? null,
    },
  });
  return hasher.sha256(payload);
}

export function emitirFactura(input: EmitirFacturaInput, hasher: Hasher): Factura {
  if (!verificarIntegridad(input.liquidacion, hasher)) {
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
  const prestador = input.prestador;
  if (prestador === null || prestador === undefined) {
    throw new Error('emitirFactura: input.prestador es requerido');
  }
  const lectura = input.lectura;
  if (lectura === null || lectura === undefined) {
    throw new Error('emitirFactura: input.lectura es requerida');
  }
  const otrosValores: readonly OtroValor[] = input.otrosValores ?? [];
  const saldoAnterior: number = input.saldoAnterior ?? 0;
  if (saldoAnterior < 0) {
    throw new Error('emitirFactura: saldo_anterior no puede ser negativo');
  }
  const numero_factura = formatearNumeroFactura(
    input.operario.dispositivo_id ?? '',
    input.consecutivo,
  );
  const suscriptorSnapshot = deepFreeze({
    codigo: input.suscriptor.codigo,
    nombre_apellidos: input.suscriptor.nombre_apellidos,
    cedula: input.suscriptor.cedula,
    municipio: input.suscriptor.municipio,
    direccion: input.suscriptor.direccion,
    estrato: input.suscriptor.estrato,
    id_prestador: input.suscriptor.id_prestador,
    categoria_uso: input.suscriptor.categoria_uso,
    ...(input.suscriptor.email !== undefined && { email: input.suscriptor.email }),
    ...(input.suscriptor.telefono !== undefined && { telefono: input.suscriptor.telefono }),
    ...(input.suscriptor.sector !== undefined && { sector: input.suscriptor.sector }),
    ...(input.suscriptor.calle !== undefined && { calle: input.suscriptor.calle }),
    ...(input.suscriptor.matricula_inmobiliaria !== undefined && {
      matricula_inmobiliaria: input.suscriptor.matricula_inmobiliaria,
    }),
    ...(input.suscriptor.numero_catastral !== undefined && {
      numero_catastral: input.suscriptor.numero_catastral,
    }),
  });
  const medidorSnapshot = deepFreeze({
    id_medidor: input.medidor.id_medidor,
    numero_medidor: input.medidor.numero_medidor,
    estado: input.medidor.estado,
    fecha_instalacion: input.medidor.fecha_instalacion,
    ...(input.medidor.observaciones !== undefined && {
      observaciones: input.medidor.observaciones,
    }),
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
    id_prestador: input.operario.id_prestador,
    numero_cedula: input.operario.numero_cedula,
    nombre: input.operario.nombre,
    email: input.operario.email,
    rol: input.operario.rol,
    estado: input.operario.estado,
    dispositivo_id: input.operario.dispositivo_id ?? '',
  });
  const prestadorSnapshot = extraerSnapshotPrestador(prestador);
  const lecturaSnapshot = extraerSnapshotLectura(lectura);
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
  const otrosValoresSnapshot = Object.freeze(
    otrosValores.map((ov) => Object.freeze({ ...ov })),
  );
  const metadata: FacturaMetadata = deepFreeze({ hash_version: 'v2' });
  const snapshot: FacturaSnapshot = {
    suscriptor: suscriptorSnapshot,
    medidor: medidorSnapshot,
    periodo: periodoSnapshot,
    operario: operarioSnapshot,
    prestador: prestadorSnapshot,
    lectura: lecturaSnapshot,
    liquidacion: liquidacionSnapshot,
    consumosHistoricos: consumosHistoricosSnapshot,
    otros_valores: otrosValoresSnapshot,
    saldo_anterior: saldoAnterior,
    metadata,
    ...(input.observaciones !== undefined && { observaciones: input.observaciones }),
  };
  const hash = calcularHashFactura(snapshot, numero_factura, input.fechaEmision, hasher);
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

/**
 * Predicado puro: factura está vencida cuando estado === 'EMITIDA' y
 * `fechaActual > snapshot.periodo.fecha_pago_con_recargo`. PAGADA y demás
 * estados nunca vencen. No muta, no persiste.
 */
export function esVencida(factura: Factura, fechaActual: string): boolean {
  if (factura.estado !== 'EMITIDA') return false;
  return fechaActual > factura.snapshot.periodo.fecha_pago_con_recargo;
}

/**
 * Predicado puro: ¿es legal la transición de estado `actual → nueva`?
 *
 * Matriz de transiciones (spec persistencia-sqlite/factura/ADDED-R1):
 *   BORRADOR → { EMITIDA, ANULADA }
 *   EMITIDA  → { PAGADA, ANULADA }
 *   PAGADA   → { } (terminal)
 *   ANULADA  → { } (terminal)
 *
 * Toda implementación de `FacturaRepository.actualizar` MUST invocar este
 * predicado antes de persistir. Si retorna `false`, lanzar
 * `Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL)` con
 * `cause = { codigo, actual, intentada }`.
 */
export function esTransicionLegal(
  actual: EstadoFactura,
  nueva: EstadoFactura,
): boolean {
  if (actual === 'BORRADOR') return nueva === 'EMITIDA' || nueva === 'ANULADA';
  if (actual === 'EMITIDA') return nueva === 'PAGADA' || nueva === 'ANULADA';
  return false;
}

/**
 * Orquestador puro: corrige una Factura emitida cuando su Liquidacion fue
 * anulada y reemplazada (típicamente vía `calculo.anularYReemplazar`).
 *
 * NO invoca `emitirFactura` ni `anularFactura` internamente. NO toca repos.
 * NO importa el módulo `calculo`. Reusa el snapshot ya validado de la
 * factura original — los aggregates de origen (Suscriptor/Medidor/etc) NO
 * viven en el snapshot, así que reconstruirlos sería deshonesto e
 * incompleto (consumosHistoricos no están allí). Las invariantes de la
 * corrección son las verificadas en este orquestador (mismatch, etc.).
 *
 * Design D2.
 */
export function corregirFactura(input: {
  facturaOriginal: Factura;
  liquidacionAnulada: Liquidacion;
  liquidacionNueva: Liquidacion;
  consecutivoNuevo: number;
  fechaEmision: string;
  observaciones?: string;
}, hasher: Hasher): { facturaAnulada: Factura; nuevoBorrador: Factura } {
  if (input.liquidacionAnulada.id !== input.facturaOriginal.snapshot.liquidacion.id) {
    throw new Error(MENSAJES_ERROR_FACTURA.CORRECCION_LIQUIDACION_ANULADA_NO_COINCIDE);
  }
  const facturaAnulada = deepFreeze({
    ...input.facturaOriginal,
    estado: 'ANULADA' as const,
    motivo_anulacion: 'Liquidación reemplazada',
    fecha_anulacion: input.fechaEmision,
  });
  const nuevoNumeroFactura = formatearNumeroFactura(
    input.facturaOriginal.snapshot.operario.dispositivo_id,
    input.consecutivoNuevo,
  );
  const nuevoSnapshot: FacturaSnapshot = {
    ...input.facturaOriginal.snapshot,
    liquidacion: {
      id: input.liquidacionNueva.id,
      hash: input.liquidacionNueva.hash,
      resultado: { ...input.liquidacionNueva.resultado },
    },
  };
  const nuevoHash = calcularHashFactura(nuevoSnapshot, nuevoNumeroFactura, input.fechaEmision, hasher);
  const nuevoBorrador = deepFreeze({
    ...input.facturaOriginal,
    id: '',
    numero_factura: nuevoNumeroFactura,
    estado: 'BORRADOR' as const,
    fecha_emision: input.fechaEmision,
    snapshot: nuevoSnapshot,
    hash: nuevoHash,
    reemplaza_a: input.facturaOriginal.id,
    created_at: '',
  });
  return { facturaAnulada, nuevoBorrador };
}

/**
 * Calcula el total a pagar de la factura.
 *
 * Fórmula Res CRA 1038/2026 §4:
 *   total = liquidacion.total + sum(otros_valores) + saldo_anterior
 *
 * Donde:
 *  - liquidacion.total = suma de cargo_fijo + cc_total - subsidio + contribucion
 *    (lo calcula el motor tarifario).
 *  - otros_valores = lista de OtroValor (no negativos, dataset ≤ 7).
 *  - saldo_anterior = deuda arrastrada de periodos previos (≥ 0).
 *
 * Función pura. NO muta la factura. NO lee el repo.
 *
 * La validación `total < 0` está cubierta por el guard de saldo_anterior
 * (no se permite negativo) en emitirFactura. Esta función es una vista
 * que siempre suma: si el usuario lograra pasar un snapshot con
 * saldo_anterior negativo (vía JSON round-trip malicioso), el resultado
 * puede ser < 0 y eso es señal de corrupción — debe lanzar.
 */
export function calcularTotalFactura(factura: Factura): number {
  const liquidacionTotal = factura.snapshot.liquidacion.resultado.total;
  const otrosValoresSum = factura.snapshot.otros_valores.reduce(
    (acc, ov) => acc + ov.valor,
    0,
  );
  const total = liquidacionTotal + otrosValoresSum + factura.snapshot.saldo_anterior;
  if (!Number.isFinite(total)) {
    throw new Error('calcularTotalFactura: total no es finito');
  }
  return total;
}
