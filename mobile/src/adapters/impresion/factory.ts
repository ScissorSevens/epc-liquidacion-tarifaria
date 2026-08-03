/**
 * Factory `obtenerAdaptadores()` — carga lazy de los adapters
 * Bluetooth. Cada adapter intenta su `require` nativo al instanciarse;
 * si el require falla (lib no instalada, development build sin
 * link), `cargaLazyOk=false` y se omite del resultado.
 *
 * Cache singleton a nivel modulo: la primera llamada ejecuta los
 * requires; subsiguientes retornan la misma lista (los adapters
 * sobreviven entre llamadas).
 *
 * Test seams: `__setearAdaptadoresPrueba()` / `__resetearAdaptadoresPrueba()`
 * permiten a los tests inyectar adapters deterministicos.
 */

import type { ImpresoraTermica } from '@dominio/impresion';
import { AdaptadorBlePlx } from './adaptador-ble-plx';
import { AdaptadorBluetoothEscpos } from './adaptador-bluetooth-escpos';

export interface AdaptadorDisponible {
  readonly adapter: ImpresoraTermica;
  readonly cargaLazyOk: boolean;
  readonly errorCarga?: string;
}

let cached: readonly AdaptadorDisponible[] | null = null;
let override: readonly ImpresoraTermica[] | null = null;

export async function obtenerAdaptadores(): Promise<readonly AdaptadorDisponible[]> {
  if (override !== null) {
    return override.map((a) => ({ adapter: a, cargaLazyOk: true }));
  }
  if (cached !== null) return cached;

  const adapters: AdaptadorDisponible[] = [];
  try {
    const ble = new AdaptadorBlePlx();
    adapters.push({ adapter: ble, cargaLazyOk: ble.estado() !== 'error' });
  } catch (err) {
    adapters.push({
      adapter: {} as ImpresoraTermica,
      cargaLazyOk: false,
      errorCarga: (err as Error).message,
    });
  }
  try {
    const spp = new AdaptadorBluetoothEscpos();
    adapters.push({ adapter: spp, cargaLazyOk: spp.estado() !== 'error' });
  } catch (err) {
    adapters.push({
      adapter: {} as ImpresoraTermica,
      cargaLazyOk: false,
      errorCarga: (err as Error).message,
    });
  }

  // Filtrar adapters que no cargaron OK.
  cached = adapters.filter((a) => a.cargaLazyOk);
  return cached;
}

export function __setearAdaptadoresPrueba(
  adapters: readonly ImpresoraTermica[],
): void {
  override = adapters;
  cached = null;
}

export function __resetearAdaptadoresPrueba(): void {
  override = null;
  cached = null;
}
