// Resolucion de la URL base del backend MediApp.
//
// Lee de `expo.extra` en `app.json` via `expo-constants`. Mantenemos dos
// claves para tener flexibilidad futura sin recompilar:
//   - `apiBaseUrl`     -> default emulador Android (`10.0.2.2:5080`).
//   - `apiBaseUrlLan`  -> IP LAN del host Windows (`172.100.7.217:5080`),
//                          que es lo que necesita un celu fisico de la EPC
//                          conectado a la misma red WiFi.
//
// Decision para este sprint (dia 3): devolvemos SIEMPRE `apiBaseUrlLan`.
// Justificacion: el target real son las tablets/celus de la EPC en LAN.
// El emulador Android tambien resuelve la IP LAN si la maquina host esta
// en la misma red, asi que sirve para ambos escenarios sin branching.
//
// Para apuntar a otra IP (cambio de red, otro host) se edita
// `app.json` -> `expo.extra.apiBaseUrlLan` y se reinicia Expo.
//
// TODO post-sprint: detectar si estamos en emulador (ej. via
// `expo-device`/`Device.isDevice === false`) para elegir `apiBaseUrl`
// automaticamente. Por ahora, decision manual en el config.

import Constants from 'expo-constants';

interface ExtraConfig {
  apiBaseUrl?: string;
  apiBaseUrlLan?: string;
}

/**
 * URL base del backend MediApp para esta build.
 * Lanza si la config no esta presente — preferimos fallar temprano
 * a sincronizar contra una URL placeholder.
 */
export function obtenerApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  const lan = extra.apiBaseUrlLan;
  const fallback = extra.apiBaseUrl;

  const elegida = lan ?? fallback;
  if (!elegida) {
    throw new Error(
      'apiBaseUrl no configurada. Definir expo.extra.apiBaseUrlLan en app.json.',
    );
  }
  return elegida;
}
