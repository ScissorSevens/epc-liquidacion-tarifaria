// mobile/src/adapters/persistir-y-encolar-lectura.ts
//
// Adapter orquestador: persiste una lectura en SQLite local y la encola
// para sincronizar con el backend.
//
// Vive en `mobile/src/adapters/` (NO en `src/` dominio) porque el
// dominio puro quedó congelado pre-entrega (D33). Este adapter cierra
// el gap del flujo capturar→sincronizar (Bug A — la pantalla nunca
// llamaba a `lecturaRepo.guardar` ni a `colaRepo.guardar`).
//
// Decisiones de diseño:
//  - 1 solo item `LECTURA`, payload = la `Lectura` completa snake_case
//    (con `id_lectura` ya asignado por la repo).
//  - NO encolamos `EVIDENCIA` ni `LIQUIDACION` por separado: la
//    evidencia viaja embebida en la lectura, la liquidación la deriva
//    el backend.
//  - El adapter NO atrapa errores: `withTransactionAsync` hace COMMIT si
//    guardar lectura + consultar dependencias + encolar resuelven, o ROLLBACK
//    automatico si cualquiera rechaza. El error original sube al caller.

import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Medidor } from '@dominio/medidores/types';
import type { ItemCola } from '@dominio/sincronizacion/types';
import type { Hasher, IdGenerator } from '@dominio/shared/ports';

/**
 * Subset estructural del `LecturaRepository` que usamos. Tipamos solo
 * `guardar` para no acoplarnos al resto de la interface (listar,
 * filtros, etc.) y permitir mocks mínimos en tests.
 */
export interface LecturaRepoGuardar {
  guardar(lectura: Lectura): Promise<Lectura>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * Subset estructural del `ColaRepository`. Necesitamos `guardar` para
 * encolar el item LECTURA y `listar` para detectar items MEDIDOR
 * pendientes y armar `dependeDe` (Camino 3).
 */
export interface ColaRepoGuardar {
  guardar(item: ItemCola): Promise<void>;
  listar(): Promise<ItemCola[]>;
}

export interface PersistirYEncolarDeps {
  readonly lectura: Lectura;
  readonly lecturaRepo: LecturaRepoGuardar;
  readonly colaRepo: ColaRepoGuardar;
  readonly idGenerator: IdGenerator;
  readonly hasher: Hasher;
}

export interface PersistirYEncolarResultado {
  readonly idItemCola: string;
  readonly lectura: Lectura;
}

/**
 * Persiste la lectura y encola un item `LECTURA` con el payload ya
 * conteniendo el `id_lectura` asignado por la persistencia.
 *
 * Camino 3 — `dependeDe`: si el medidor referenciado por la lectura
 * todavia tiene un item `MEDIDOR` con estado `PENDIENTE` o `ENVIANDO`
 * en la cola (alta reciente sin sincronizar), encolamos la lectura con
 * `dependeDe = [idItemMedidor]`. Asi el procesador respeta el orden
 * MEDIDOR → LECTURA y la FK en backend queda resuelta.
 *
 * Si NO hay item MEDIDOR pendiente (medidor ya sincronizado o nunca
 * estuvo en cola), encolamos sin `dependeDe`.
 *
 * Errores: si cualquier operacion lanza, expo-sqlite revierte lectura e item
 * de cola automaticamente y el error original se propaga al caller.
 */
export async function persistirYEncolarLectura(
  deps: PersistirYEncolarDeps,
): Promise<PersistirYEncolarResultado> {
  const { lectura, lecturaRepo, colaRepo, idGenerator, hasher } = deps;
  let resultado: PersistirYEncolarResultado | undefined;

  // expo-sqlite 16 no entrega `tx` a withTransactionAsync; los repos
  // comparten la conexion y sus queries participan en la transaccion activa.
  await lecturaRepo.withTransactionAsync(async () => {
    const lecturaPersistida = await lecturaRepo.guardar(lectura);

    // Lookup MEDIDOR pendiente para armar dependeDe (Camino 3).
    const itemsCola = await colaRepo.listar();
    const itemMedidorPendiente = itemsCola.find((it) => {
      if (it.tipo !== 'MEDIDOR') return false;
      if (it.estado !== 'PENDIENTE' && it.estado !== 'ENVIANDO') return false;
      const med = it.payload as Medidor | undefined;
      return med?.id_medidor === lecturaPersistida.id_medidor;
    });

    const idItemCola = idGenerator.uuid();
    const hashLocal = hasher.sha256(JSON.stringify(lecturaPersistida));
    const item: ItemCola = {
      id: idItemCola,
      tipo: 'LECTURA',
      payload: lecturaPersistida,
      hashLocal,
      estado: 'PENDIENTE',
      intentos: 0,
      ultimoError: null,
      ultimoIntentoEn: null,
      creadoEn: new Date(),
      ...(itemMedidorPendiente ? { dependeDe: [itemMedidorPendiente.id] } : {}),
    };

    await colaRepo.guardar(item);
    resultado = { idItemCola, lectura: lecturaPersistida };
  });

  if (resultado === undefined) {
    throw new Error('persistirYEncolarLectura: la transaccion finalizo sin resultado');
  }
  return resultado;
}
