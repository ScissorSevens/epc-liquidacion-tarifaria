/**
 * Helper de testing: implementación in-memory de `FacturaRepository`.
 *
 * NO se exporta en `src/factura/index.ts` — es fixture de tests.
 * Implementación productiva (SQLite) vive en Iter 7. Este helper sirve
 * para tests de orquestadores `*ConRepo` y para tests futuros de
 * integración entre módulos.
 *
 * Patrón: factory function con closures sobre `Map<string, Factura>`
 * (sin classes, alineado con convención del proyecto).
 *
 * Invariantes que emula del schema SQLite (design D7):
 * - UNIQUE PARCIAL sobre `liquidacion_id` WHERE `estado != 'ANULADA'`.
 *   Permite el flujo "anular + recrear": una vez anulada la factura, el
 *   `liquidacion_id` queda libre para una nueva factura no-anulada.
 *   Implementado con `liquidacionesActivas: Map<liqId, Set<facturaId>>`.
 */

import { MENSAJES_ERROR_FACTURA, type Factura, type FacturaRepository } from '../types';
import { esTransicionLegal } from '../factura';

function lanzarRestriccionUnicidad(liquidacion_id: string): never {
  const err = new Error(MENSAJES_ERROR_FACTURA.RESTRICCION_UNICIDAD);
  (err as Error & { cause: unknown }).cause = {
    codigo: 'RESTRICCION_UNICIDAD',
    ctx: { liquidacion_id },
  };
  throw err;
}

export function crearFacturaRepositoryInMemory(): FacturaRepository {
  const store = new Map<string, Factura>();
  // liquidacion_id → set de factura ids no-anuladas que la referencian.
  // Si el set queda con 1+ elementos, otro INSERT no-anulado para el mismo
  // liquidacion_id debe fallar (UNIQUE parcial WHERE estado != 'ANULADA').
  const liquidacionesActivas = new Map<string, Set<string>>();

  function indexarLiquidacionActiva(factura: Factura): void {
    if (factura.estado === 'ANULADA') return;
    const liqId = factura.snapshot.liquidacion.id;
    let set = liquidacionesActivas.get(liqId);
    if (!set) {
      set = new Set<string>();
      liquidacionesActivas.set(liqId, set);
    }
    set.add(factura.id);
  }

  function liberarLiquidacion(factura: Factura): void {
    const liqId = factura.snapshot.liquidacion.id;
    const set = liquidacionesActivas.get(liqId);
    if (!set) return;
    set.delete(factura.id);
    if (set.size === 0) liquidacionesActivas.delete(liqId);
  }

  return {
    async crear(factura: Factura): Promise<Factura> {
      // UNIQUE parcial: si ya existe alguna factura no-anulada con el mismo
      // liquidacion_id, rechazar antes de tocar el store.
      if (factura.estado !== 'ANULADA') {
        const liqId = factura.snapshot.liquidacion.id;
        const set = liquidacionesActivas.get(liqId);
        if (set && set.size > 0) {
          lanzarRestriccionUnicidad(liqId);
        }
      }
      store.set(factura.id, factura);
      indexarLiquidacionActiva(factura);
      return factura;
    },
    async buscarPorId(id: string): Promise<Factura | null> {
      return store.get(id) ?? null;
    },
    async buscarPorPeriodo(idPeriodo: string): Promise<readonly Factura[]> {
      return Array.from(store.values()).filter(
        (f) => f.snapshot.periodo.id_periodo === idPeriodo,
      );
    },
    async buscarPorSuscriptor(idSuscriptor: number): Promise<readonly Factura[]> {
      // Discrepancia puerto vs snapshot: puerto pide id_suscriptor:number,
      // snapshot guarda codigo:string. Match por codigo serializado —
      // contrato del helper, productivo (SQLite Iter 7) podra usar id real.
      return Array.from(store.values()).filter(
        (f) => f.snapshot.suscriptor.codigo === String(idSuscriptor),
      );
    },
    async actualizar(id, cambios): Promise<Factura> {
      const existente = store.get(id);
      if (!existente) {
        throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ENCONTRADA);
      }
      // Validar transiciones SOLO si el estado efectivamente cambia.
      if (cambios.estado !== existente.estado) {
        if (!esTransicionLegal(existente.estado, cambios.estado)) {
          // Asignamos `cause` post-construccion: `new Error(msg, { cause })` requiere
          // ES2022 lib y este proyecto usa ES2020. El field es nativo en runtime
          // (Node >=16.9), solo el tipo no esta disponible en lib ES2020.
          const err = new Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL);
          (err as Error & { cause: unknown }).cause = {
            codigo: 'TRANSICION_ILEGAL',
            actual: existente.estado,
            intentada: cambios.estado,
          };
          throw err;
        }
      }
      const actualizada = Object.freeze({ ...existente, ...cambios }) as Factura;
      store.set(id, actualizada);
      // Mantener índice de unicidad: si pasa a ANULADA, liberar; si sale de
      // ANULADA, re-indexar. (En la matriz legal nunca se sale de ANULADA,
      // pero el helper se mantiene defensivo.)
      if (existente.estado !== 'ANULADA' && actualizada.estado === 'ANULADA') {
        liberarLiquidacion(existente);
      } else if (existente.estado === 'ANULADA' && actualizada.estado !== 'ANULADA') {
        indexarLiquidacionActiva(actualizada);
      }
      return actualizada;
    },
    async listar(): Promise<readonly Factura[]> {
      return Array.from(store.values());
    },
  };
}
