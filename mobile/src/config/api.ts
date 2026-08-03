// Resolución de la URL base del backend AquaServices.
//
// Estrategia de resolución (en orden de prioridad):
//
//   1. `expo.extra.apiBaseUrl` en app.json  →  override manual explícito.
//      Usalo solo si necesitás apuntar a un servidor fijo (producción, staging).
//      Si está definida, se usa siempre sin importar nada más.
//      ⚠️ Debe ser HTTPS en producción (TICKET-P0.4 seguridad).
//
//   2. `Constants.expoConfig.hostUri`  →  resolución AUTOMÁTICA durante desarrollo.
//      Expo expone la IP del host que está corriendo Metro (ej. "192.168.1.70:8081").
//      Extraemos la IP de ahí y la combinamos con PUERTO_BACKEND.
//      Esto funciona en celular físico Y emulador sin tocar nada cuando cambia la red.
//
//   3. Fallback `10.0.2.2:PUERTO_BACKEND`  →  emulador Android sin hostUri.
//
// Para desarrollo: no hace falta tocar app.json nunca más.
// Para producción: definir `expo.extra.apiBaseUrl` con HTTPS fijo (ej. "https://api.epc.gov.co").

import Constants from 'expo-constants';

/** Puerto donde escucha AquaServices.Api.
 *  - Desarrollo local (dotnet run): 5180
 *  - Docker (docker compose):       5080
 *  Usar 5080 como default para que Docker funcione sin tocar nada.
 *  Si corrés dotnet run directamente, cambiá este valor a 5180.
 */
const PUERTO_BACKEND = 5080;

interface ExtraConfig {
  apiBaseUrl?: string;
}

/** Hosts que son explícitamente localhost / loopback. */
const HOSTS_LOOPBACK = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

/**
 * Determina si la app está corriendo en modo producción.
 * Se considera producción si:
 *   - `expo.extra.apiBaseUrl` está definido (override manual), O
 *   - `__DEV__` es false (release build de Expo)
 */
function esProduccion(): boolean {
  if (Constants.expoConfig?.extra && (Constants.expoConfig.extra as ExtraConfig).apiBaseUrl) {
    return true;
  }
  return !__DEV__;
}

/**
 * Valida que la URL de producción use HTTPS. Emite warning explícito
 * si está en producción y la URL es HTTP (TICKET-P0.4 seguridad: P0.4
 * prohíbe HTTP en producción para evitar sniffeo de credenciales).
 *
 * En desarrollo local (http://) está permitido y no genera warning.
 */
function validarSchemeProduccion(url: string, esProd: boolean): string {
  if (!esProd) return url;

  // Extraer host de la URL
  const match = url.match(/^https?:\/\/([^/:]+)/);
  if (!match) {
    // eslint-disable-next-line no-console
    console.warn(
      `[api] URL de producción malformada: "${url}". Debe incluir scheme http(s)://`,
    );
    return url;
  }
  const host = match[1] ?? '';
  const scheme = url.startsWith('https://') ? 'https' : 'http';

  // Permitir HTTP solo si es loopback (testing local)
  if (scheme === 'http' && !HOSTS_LOOPBACK.has(host)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[api] ⚠️ HTTP en PRODUCCIÓN detectado para host "${host}". ` +
      'Esto expone credenciales en tránsito. Configurá TLS antes del deploy.',
    );
  }
  return url;
}

/**
 * URL base del backend AquaServices para esta sesión de Expo.
 *
 * En desarrollo resuelve automáticamente la IP del host desde `hostUri`,
 * por lo que funciona sin cambios al moverse entre redes.
 *
 * En producción lee `expo.extra.apiBaseUrl` (debe ser HTTPS).
 *
 * Lanza si no puede determinar ninguna URL válida.
 */
export function obtenerApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  const esProd = esProduccion();

  // 1. Override manual explícito (producción / staging)
  if (extra.apiBaseUrl) {
    return validarSchemeProduccion(extra.apiBaseUrl, esProd);
  }

  // 2. Resolución automática desde hostUri de Expo (solo dev)
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
