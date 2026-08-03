/**
 * Stub del factory de adapters Bluetooth. Implementacion real (lazy
 * require de `react-native-ble-plx` + `react-native-bluetooth-escpos-printer`)
 * llega en commit 10.
 */

import type { ImpresoraTermica } from '@dominio/impresion';

export interface AdaptadorDisponible {
  readonly adapter: ImpresoraTermica;
  readonly cargaLazyOk: boolean;
  readonly errorCarga?: string;
}

export async function obtenerAdaptadores(): Promise<readonly AdaptadorDisponible[]> {
  return [];
}

export function __setearAdaptadoresPrueba(
  _adapters: readonly ImpresoraTermica[],
): void {
  // noop
}

export function __resetearAdaptadoresPrueba(): void {
  // noop
}
