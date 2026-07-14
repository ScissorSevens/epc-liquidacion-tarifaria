/**
 * Migracion defensiva de datos legacy en cold-boot.
 *
 * TICKET-EPIC-LOGIN-001 — Fase 4 Tarea 4.3.2:
 * Antes del fix de 4.3.1 (eliminar el bypass de `Configuracion.tsx`), la
 * app creaba automaticamente un operario dummy con `id_operario = 0` y
 * `numero_cedula = 'placeholder'` cuando no encontraba la cedula en
 * AsyncStorage. Cualquier dispositivo que se actualizo desde esa version
 * queda con ese operario fantasma en su DB local.
 *
 * Si lo dejamos, el flujo de carga podria considerarlo como "ya logueado"
 * con datos basura. Este helper detecta y limpia esa condicion al arrancar.
 *
 * QUE HACE:
 *   1. Lista todos los operarios en la DB local.
 *   2. Para cada uno con `id_operario = 0` o `numero_cedula = 'placeholder'`,
 *      llama `repo.eliminarPorCedula()` (idempotente — FASE 4.3.2 repo).
 *   3. Borra la clave `cedula_operario` de AsyncStorage (defensivo:
 *      aunque la cedula de la sesion vieja no sea exactamente 'placeholder',
 *      preferimos limpiar y forzar al operario a re-vincularse con
 *      `cedula + password` por el flujo legitimo).
 *
 * IDEMPOTENTE:
 *   Correrla varias veces seguidas no rompe nada ni duplica operaciones.
 *   Si no hay legacy data, los DELETE son no-op y removeItem sobre clave
 *   inexistente resuelve sin error.
 *
 * DEFENSIVA:
 *   Si la DB no abre o cualquier operacion falla, NO propaga el error.
 *   Es cleanup de cold-boot — el flujo de AuthGate no debe quedar
 *   bloqueado por una limpieza que ya no es necesaria.
 *
 * WIRE-UP:
 *   AuthGate llama esta funcion al INICIO de su deteccion (Fase 4.3.2),
 *   antes de `prestadorRepo.listar()` y `cargarSesion()`. Asi, si habia
 *   datos basura, la DB queda limpia ANTES de que la deteccion decida
 *   el estado (sin_setup / sin_sesion / con_sesion).
 *
 * Cuando el equipo confirme que no quedan mas dispositivos con datos
 * legacy (ej: 6 meses despues del release), este helper puede borrarse.
 * Mientras tanto, queda como red de seguridad.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OperarioRepositoryExpoSqlite } from '../persistencia/expo-sqlite/operario-repository-expo-sqlite';
import { logger } from '../composicion/logger';

/** Cedula que el bypass viejo inyectaba en la tabla `operarios`. */
const CEDULA_LEGACY_PLACEHOLDER = 'placeholder';

/** Clave AsyncStorage donde Configuracion.tsx persiste la cedula activa. */
export const CLAVE_ASYNC_CEDULA_OPERARIO = 'cedula_operario';

/**
 * Predicado: un operario es legacy si su id es 0 (no autoincrement valido)
 * o su cedula es exactamente el placeholder del bypass viejo.
 *
 * `id_operario = 0` cubre operarios creados con id manual (caso del bypass).
 * `numero_cedula = 'placeholder'` cubre cualquier variante donde el autoinc
 * le asigno un id real pero la cedula quedo con la cadena magica.
 */
function esOperarioLegacy(op: { id_operario: number; numero_cedula: string }): boolean {
  return op.id_operario === 0 || op.numero_cedula === CEDULA_LEGACY_PLACEHOLDER;
}

/**
 * Limpia operarios legacy y la clave AsyncStorage asociada.
 *
 * Parametros:
 *   - `operarioRepo`: repo expo-sqlite de operarios (DI — el caller obtiene
 *     la conexion via `getBootstrap()` y construye el repo).
 *
 * Comportamiento:
 *   - Borra operarios legacy uno a uno via `eliminarPorCedula`.
 *   - Borra `cedula_operario` de AsyncStorage.
 *   - Si algo falla, loguea warning y NO propaga (cleanup defensivo).
 */
export async function limpiarDatosLegacyBypass(
  operarioRepo: OperarioRepositoryExpoSqlite,
): Promise<void> {
  try {
    await operarioRepo.inicializar();
    const operarios = await operarioRepo.listar();
    const legacy = operarios.filter(esOperarioLegacy);

    for (const op of legacy) {
      // eliminarPorCedula es idempotente: borrar una cedula que no
      // matchea es no-op (changes: 0, no rechaza). Esto cubre los
      // dos casos legacy:
      //   - id=0, cedula='placeholder'  → DELETE WHERE cedula='placeholder'
      //   - id=0, cedula='otro'         → DELETE WHERE cedula='otro'
      //   - id=42, cedula='placeholder' → DELETE WHERE cedula='placeholder'
      // 1 sola llamada por operario legacy. Deduplicamos por cedula para
      // no mandar el mismo DELETE dos veces si hay multiples filas con
      // la misma cedula magica.
      await operarioRepo.eliminarPorCedula(op.numero_cedula);
    }

    // Cleanup defensivo de AsyncStorage. Si no existia la clave, removeItem
    // resuelve sin error (idempotente).
    await AsyncStorage.removeItem(CLAVE_ASYNC_CEDULA_OPERARIO);
  } catch (err) {
    // Cleanup defensivo: nunca debe romper el cold-boot de AuthGate.
    logger.warn(
      'limpiarDatosLegacyBypass',
      'error en limpieza defensiva de datos legacy',
      { error: String(err) },
    );
  }
}