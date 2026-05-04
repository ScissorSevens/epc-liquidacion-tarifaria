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
 */

import { MENSAJES_ERROR_FACTURA, type Factura, type FacturaRepository } from '../types';
import { esTransicionLegal } from '../factura';

export function crearFacturaRepositoryInMemory(): FacturaRepository {
  const store = new Map<string, Factura>();

  return {
    async crear(factura: Factura): Promise<Factura> {
      store.set(factura.id, factura);
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
      return actualizada;
    },
    async listar(): Promise<readonly Factura[]> {
      return Array.from(store.values());
    },
  };
}
