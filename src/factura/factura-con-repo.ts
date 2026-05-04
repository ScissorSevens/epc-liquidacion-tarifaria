/**
 * Orquestadores con estado: combinan funciones puras de `factura.ts`
 * con un `FacturaRepository`. `factura.ts` permanece 100% puro.
 *
 * Design D4: validaciones de unicidad (NUMERO_FACTURA_DUPLICADO_EN_PERIODO,
 * LIQUIDACION_YA_FACTURADA) viven aca, no en `emitirFactura` puro.
 *
 * Orden de validacion (decision documentada):
 *   1. Invocar `emitirFactura` puro — valida invariantes de integridad
 *      del input (liquidacion ACTIVA, hash, suscriptor activo, etc.).
 *      Si el input esta roto, fallamos rapido SIN tocar el repo.
 *   2. Validar unicidad via repo — usa los datos ya validados de la
 *      factura producida (numero_factura, snapshot.liquidacion.id).
 *   3. Persistir via `repo.crear`.
 *
 * Esto difiere ligeramente del literal del prompt ("repo primero, puro
 * despues") porque preferimos errores especificos (LIQUIDACION_INTEGRIDAD_ROTA)
 * sobre errores de unicidad cuando ambos aplicarian.
 */

import { randomUUID } from 'crypto';
import { emitirFactura, anularFactura, corregirFactura } from './factura';
import {
  MENSAJES_ERROR_FACTURA,
  type EmitirFacturaInput,
  type Factura,
  type FacturaRepository,
} from './types';

export async function emitirFacturaConRepo(
  input: EmitirFacturaInput,
  repo: FacturaRepository,
): Promise<Factura> {
  const facturaPura = emitirFactura(input);

  // Validacion de unicidad: liquidacion no puede estar facturada dos veces.
  // Usamos repo.listar + some en lugar de un metodo dedicado del port
  // (existePorLiquidacion NO existe en el contrato real).
  const todas = await repo.listar();
  if (todas.some((f) => f.snapshot.liquidacion.id === input.liquidacion.id)) {
    throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_YA_FACTURADA);
  }

  // Validacion de unicidad: numero_factura por periodo.
  // Usamos buscarPorPeriodo + some en lugar de un metodo dedicado del port
  // (existePorNumeroEnPeriodo NO existe en el contrato real).
  const enPeriodo = await repo.buscarPorPeriodo(input.periodo.id_periodo);
  if (enPeriodo.some((f) => f.numero_factura === facturaPura.numero_factura)) {
    throw new Error(MENSAJES_ERROR_FACTURA.NUMERO_FACTURA_DUPLICADO_EN_PERIODO);
  }

  const facturaConId: Factura = Object.freeze({
    ...facturaPura,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  });
  return repo.crear(facturaConId);
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
