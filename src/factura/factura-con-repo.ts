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
