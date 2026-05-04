/**
 * Orquestadores con estado: combinan funciones puras de `factura.ts`
 * con un `FacturaRepository`. `factura.ts` permanece 100% puro.
 *
 * Design D4 + D7 (refactor 4.7-bis Opción A): la unicidad por
 * `liquidacion_id` (1:1 factura no-anulada ↔ liquidacion) se delega al
 * port `crear`, que la implementa con UNIQUE parcial (SQLite) o Map
 * auxiliar (in-memory). El orquestador solo traduce el error genérico
 * de port (`RESTRICCION_UNICIDAD`) al mensaje específico de dominio
 * (`LIQUIDACION_YA_FACTURADA`).
 *
 * La unicidad por `numero_factura` por periodo permanece a nivel
 * orquestador porque NO existe constraint SQL equivalente todavía
 * (UNIQUE compuesto sobre id_periodo+numero_factura está en design D5
 * pero requiere mover ese chequeo al port en una iteración posterior).
 *
 * Orden de validacion:
 *   1. Invocar `emitirFactura` puro — valida invariantes de integridad
 *      del input (liquidacion ACTIVA, hash, suscriptor activo, etc.).
 *      Si el input esta roto, fallamos rapido SIN tocar el repo.
 *   2. Validar unicidad de numero_factura via repo.buscarPorPeriodo.
 *   3. Persistir via `repo.crear`. Si el port lanza RESTRICCION_UNICIDAD
 *      (única factura no-anulada con misma liquidacion_id), traducimos
 *      a LIQUIDACION_YA_FACTURADA.
 */

import { randomUUID } from 'crypto';
import { emitirFactura, anularFactura, corregirFactura } from './factura';
import {
  MENSAJES_ERROR_FACTURA,
  type EmitirFacturaInput,
  type Factura,
  type FacturaRepository,
} from './types';

function esRestriccionUnicidad(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause !== 'object' || cause === null) return false;
  return (cause as { codigo?: unknown }).codigo === 'RESTRICCION_UNICIDAD';
}

export async function emitirFacturaConRepo(
  input: EmitirFacturaInput,
  repo: FacturaRepository,
): Promise<Factura> {
  const facturaPura = emitirFactura(input);

  // Validacion de unicidad: numero_factura por periodo (sigue en orquestador
  // hasta que se modele constraint SQL UNIQUE (id_periodo, numero_factura)
  // en el port — fuera de scope de Batch 3).
  const enPeriodo = await repo.buscarPorPeriodo(input.periodo.id_periodo);
  if (enPeriodo.some((f) => f.numero_factura === facturaPura.numero_factura)) {
    throw new Error(MENSAJES_ERROR_FACTURA.NUMERO_FACTURA_DUPLICADO_EN_PERIODO);
  }

  const facturaConId: Factura = Object.freeze({
    ...facturaPura,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  });

  try {
    return await repo.crear(facturaConId);
  } catch (err) {
    // Port lanza RESTRICCION_UNICIDAD (UNIQUE parcial sobre liquidacion_id no-anulada).
    // Traducimos al mensaje de dominio que el resto del sistema conoce.
    if (esRestriccionUnicidad(err)) {
      throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_YA_FACTURADA);
    }
    throw err;
  }
}

export async function anularFacturaConRepo(
  facturaId: string,
  motivo: string,
  repo: FacturaRepository,
): Promise<Factura> {
  const existente = await repo.buscarPorId(facturaId);
  if (!existente) {
    throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
  }
  const anulada = anularFactura(existente, motivo, new Date().toISOString());
  return repo.actualizar(facturaId, {
    estado: 'ANULADA',
    motivo_anulacion: anulada.motivo_anulacion,
    fecha_anulacion: anulada.fecha_anulacion,
  });
}

export async function corregirFacturaConRepo(
  input: Parameters<typeof corregirFactura>[0],
  repo: FacturaRepository,
): Promise<{ facturaAnulada: Factura; nuevoBorrador: Factura }> {
  // 1. Validar que facturaOriginal existe en repo (consistencia con el estado persistido).
  const existente = await repo.buscarPorId(input.facturaOriginal.id);
  if (!existente) {
    throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
  }

  // 2. Invocar corregirFactura puro. Valida coherencia liquidacionAnulada vs original
  // y produce { facturaAnulada, nuevoBorrador } con id='' en el borrador.
  const { facturaAnulada, nuevoBorrador } = corregirFactura(input);

  // 3. Persistir UPDATE de la original con fecha_anulacion incluida (port
  // extendido en cycle 4.1 acepta el campo opcional).
  await repo.actualizar(input.facturaOriginal.id, {
    estado: 'ANULADA',
    motivo_anulacion: facturaAnulada.motivo_anulacion,
    fecha_anulacion: facturaAnulada.fecha_anulacion,
  });

  // 4. Asignar id UUID al nuevoBorrador y CREATE.
  const borradorConId: Factura = Object.freeze({
    ...nuevoBorrador,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  });
  const borradorPersistido = await repo.crear(borradorConId);

  // 5. Retornar pareja: facturaAnulada se compone con la version persistida
  // (que tiene los campos efectivamente guardados, sin fecha_anulacion).
  const anuladaPersistida = (await repo.buscarPorId(input.facturaOriginal.id))!;
  return { facturaAnulada: anuladaPersistida, nuevoBorrador: borradorPersistido };
}

void MENSAJES_ERROR_FACTURA;
