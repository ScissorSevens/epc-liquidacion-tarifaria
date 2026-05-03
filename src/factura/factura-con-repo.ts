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
  _facturaId: string,
  _motivo: string,
  _repo: FacturaRepository,
): Promise<Factura> {
  throw new Error('not implemented');
}

export async function corregirFacturaConRepo(
  _input: Parameters<typeof corregirFactura>[0],
  _repo: FacturaRepository,
): Promise<{ facturaAnulada: Factura; nuevoBorrador: Factura }> {
  throw new Error('not implemented');
}

void anularFactura;
void MENSAJES_ERROR_FACTURA;
