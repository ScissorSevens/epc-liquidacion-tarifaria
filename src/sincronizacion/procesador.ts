/**
 * Procesador de la cola de sincronización.
 * Recorre items PENDIENTES y los envía al cliente HTTP.
 */

import type { ItemCola } from './types';
import type { ColaSincronizacion } from './cola-repository';

export interface RespuestaCliente {
  ok: boolean;
}

export interface ClienteSincronizacion {
  enviar(item: ItemCola): Promise<RespuestaCliente>;
}

export async function procesarCola(
  cola: ColaSincronizacion,
  cliente: ClienteSincronizacion
): Promise<void> {
  const pendientes = await cola.listarPendientes();

  for (const item of pendientes) {
    const respuesta = await cliente.enviar(item);

    if (respuesta.ok) {
      await cola.guardar({ ...item, estado: 'EXITOSO' });
    }
  }
}
