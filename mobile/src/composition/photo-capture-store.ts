/**
 * Store module-level para pasar la evidencia fotográfica desde
 * `CapturarFoto` de vuelta a `CapturarLectura` sin depender del
 * mecanismo de params de React Navigation.
 *
 * Por qué existe:
 *   `navigation.navigate('CapturarLectura', { evidenciaFoto })` puede
 *   causar que el componente se desmonte y remonte en Android con
 *   `createNativeStackNavigator`, reseteando el estado del formulario.
 *
 *   La alternativa robusta es que `CapturarFoto` llame `goBack()` y
 *   deposite la evidencia aquí. `CapturarLectura` la recoge en el
 *   listener de 'focus', garantizando que el componente nunca se
 *   remontar y el estado del formulario se preserve.
 *
 * Lifetime: la referencia vive mientras la app esté en memoria.
 *   `getAndClear` la consume una sola vez para evitar re-aplicaciones.
 */

import type { EvidenciaFoto } from '@dominio/captura-lecturas/types';

let pendiente: EvidenciaFoto | null = null;

export const photoCaptureStore = {
  /** Deposita la evidencia. Llamar desde CapturarFoto antes de goBack(). */
  setEvidencia(ev: EvidenciaFoto): void {
    pendiente = ev;
  },

  /**
   * Retira la evidencia y limpia el store.
   * Llamar desde CapturarLectura en el listener de 'focus'.
   * Devuelve null si no hay evidencia pendiente.
   */
  getAndClear(): EvidenciaFoto | null {
    const ev = pendiente;
    pendiente = null;
    return ev;
  },
};
