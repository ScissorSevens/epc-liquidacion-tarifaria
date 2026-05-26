// Resolución de la URL base del backend AquaRuta.
//
// Estrategia de resolución (en orden de prioridad):
//
//   1. `expo.extra.apiBaseUrl` en app.json  →  override manual explícito.
//      Usalo solo si necesitás apuntar a un servidor fijo (producción, staging).
//      Si está definida, se usa siempre sin importar nada más.
//
//   2. `Constants.expoConfig.hostUri`  →  resolución AUTOMÁTICA durante desarrollo.
//      Expo expone la IP del host que está corriendo Metro (ej. "192.168.1.70:8081").
//      Extraemos la IP de ahí y la combinamos con PUERTO_BACKEND.
//      Esto funciona en celular físico Y emulador sin tocar nada cuando cambia la red.
//
//   3. Fallback `10.0.2.2:PUERTO_BACKEND`  →  emulador Android sin hostUri.
//
// Para desarrollo: no hace falta tocar app.json nunca más.
// Para producción: definir `expo.extra.apiBaseUrl` con la URL fija del servidor.

import Constants from 'expo-constants';

/** Puerto donde escucha AquaRuta.Api. Cambiar solo si se reconfigura el backend. */
const PUERTO_BACKEND = 5180;

interface ExtraConfig {
  apiBaseUrl?: string;
}

/**
 * URL base del backend AquaRuta para esta sesión de Expo.
 *
 * En desarrollo resuelve automáticamente la IP del host desde `hostUri`,
 * por lo que funciona sin cambios al moverse entre redes.
 *
 * Lanza si no puede determinar ninguna URL válida.
 */
export function obtenerApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

  // 1. Override manual explícito (producción / staging)
  if (extra.apiBaseUrl) {
    return extra.apiBaseUrl;
  }

  // 2. Resolución automática desde hostUri de Expo
  //    hostUri tiene la forma "192.168.x.x:8081" (ip:puertoMetro)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:${PUERTO_BACKEND}`;
    }
  }

  // 3. Fallback emulador Android (host = 10.0.2.2)
  return `http://10.0.2.2:${PUERTO_BACKEND}`;
}
