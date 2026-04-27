/**
 * Procesador de la cola de sincronización.
 * - Recorre items PENDIENTES listos para reintentar
 * - Envía vía cliente HTTP inyectado
 * - Maneja errores con reintentos exponenciales
 * - Una falla NO bloquea otros items
 * - Items que superan MAX_INTENTOS pasan a FALLIDO
 */

import type { ItemCola } from './types';
import type { ColaSincronizacion } from './cola-repository';
import { listoParaReintentar, MAX_INTENTOS } from './reintentos';

export interface RespuestaCliente {
  ok: boolean;
  error?: string;
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
    // Respetar delay exponencial
    if (!listoParaReintentar(item.intentos, item.ultimoIntentoEn)) {
      continue;
    }

    let respuesta: RespuestaCliente;
    let mensajeError: string | null = null;

    try {
      respuesta = await cliente.enviar(item);
    } catch (e) {
      respuesta = { ok: false };
      mensajeError = e instanceof Error ? e.message : String(e);
    }

    if (respuesta.ok) {
      await cola.guardar({
        ...item,
        estado: 'EXITOSO',
        ultimoIntentoEn: new Date(),
      });
      continue;
    }

    // Falló — incrementar intentos y decidir estado
    const nuevosIntentos = item.intentos + 1;
    const errorFinal = mensajeError ?? respuesta.error ?? 'Error desconocido';
    const nuevoEstado = nuevosIntentos >= MAX_INTENTOS ? 'FALLIDO' : 'PENDIENTE';

    await cola.guardar({
      ...item,
      estado: nuevoEstado,
      intentos: nuevosIntentos,
      ultimoError: errorFinal,
      ultimoIntentoEn: new Date(),
    });
  }
}
