/**
 * Procesador de la cola de sincronización.
 * - Recorre items PENDIENTES listos para reintentar
 * - Respeta orden de dependencias (dependeDe)
 * - Envía vía cliente HTTP inyectado
 * - Maneja errores con reintentos exponenciales
 * - Detecta conflictos por hash → marca CONFLICTO (sin reintentar)
 * - Una falla NO bloquea otros items
 * - Items que superan MAX_INTENTOS pasan a FALLIDO
 */

import type { ItemCola, DecisionConflicto } from './types';
import type { ColaSincronizacion } from './cola-repository';
import { listoParaReintentar, MAX_INTENTOS } from './reintentos';

export interface RespuestaCliente {
  ok: boolean;
  error?: string;
  conflicto?: boolean;
  hashServer?: string;
}

export interface ClienteSincronizacion {
  enviar(item: ItemCola): Promise<RespuestaCliente>;
}

/**
 * Verifica si TODAS las dependencias del item están en EXITOSO.
 * Items sin dependeDe siempre pasan.
 */
function dependenciasResueltas(item: ItemCola, todos: ItemCola[]): boolean {
  if (!item.dependeDe || item.dependeDe.length === 0) return true;

  const indice = new Map(todos.map((i) => [i.id, i]));
  return item.dependeDe.every((depId) => indice.get(depId)?.estado === 'EXITOSO');
}

export async function procesarCola(
  cola: ColaSincronizacion,
  cliente: ClienteSincronizacion
): Promise<void> {
  const todos = await cola.listar();
  const pendientes = todos.filter((i) => i.estado === 'PENDIENTE');

  for (const item of pendientes) {
    // 1. Respetar dependencias
    if (!dependenciasResueltas(item, todos)) continue;

    // 2. Respetar delay exponencial
    if (!listoParaReintentar(item.intentos, item.ultimoIntentoEn)) continue;

    let respuesta: RespuestaCliente;
    let mensajeError: string | null = null;

    try {
      respuesta = await cliente.enviar(item);
    } catch (e) {
      respuesta = { ok: false };
      mensajeError = e instanceof Error ? e.message : String(e);
    }

    // 3. Éxito
    if (respuesta.ok) {
      const actualizado: ItemCola = {
        ...item,
        estado: 'EXITOSO',
        ultimoIntentoEn: new Date(),
      };
      await cola.guardar(actualizado);
      // Mantener `todos` actualizado para que items siguientes vean la nueva dependencia resuelta
      const idx = todos.findIndex((t) => t.id === item.id);
      if (idx >= 0) todos[idx] = actualizado;
      continue;
    }

    // 4. Conflicto detectado por server (NO incrementa intentos)
    if (respuesta.conflicto) {
      await cola.guardar({
        ...item,
        estado: 'CONFLICTO',
        hashServer: respuesta.hashServer,
        ultimoIntentoEn: new Date(),
      });
      continue;
    }

    // 5. Error normal — reintentar o marcar FALLIDO
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

/**
 * Resuelve un item en CONFLICTO según la decisión del operario.
 */
export async function resolverConflicto(
  cola: ColaSincronizacion,
  itemId: string,
  decision: DecisionConflicto
): Promise<void> {
  const item = await cola.buscarPorId(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} no encontrado`);
  }
  if (item.estado !== 'CONFLICTO') {
    throw new Error(
      `Item ${itemId} no está en CONFLICTO (estado actual: ${item.estado})`
    );
  }

  switch (decision) {
    case 'SOBRESCRIBIR_LOCAL':
      await cola.guardar({
        ...item,
        estado: 'PENDIENTE',
        forzarSobrescribir: true,
        intentos: 0,
        ultimoError: null,
        ultimoIntentoEn: null,
      });
      return;

    case 'SOBRESCRIBIR_SERVER':
      await cola.guardar({ ...item, estado: 'EXITOSO' });
      return;

    case 'DESCARTAR':
      await cola.guardar({ ...item, estado: 'DESCARTADO' });
      return;
  }
}
