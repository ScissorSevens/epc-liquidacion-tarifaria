// Helper singleton para acceder al BootstrapApp desde cualquier pantalla.
//
// `bootstrapApp()` abre la DB SQLite y aplica migraciones — es caro y NO
// debe ejecutarse en cada montaje. Cacheamos la PROMESA (no el resultado)
// para que multiples pantallas que pidan el bootstrap en paralelo durante
// el primer arranque compartan la misma inicializacion en lugar de
// dispararla N veces.
//
// Si la IP del host cambia (red diferente), el cache se invalida
// automaticamente y el proximo getBootstrap() resuelve la nueva URL.

import { bootstrapApp, type BootstrapApp } from './bootstrap';
import { obtenerApiBaseUrl } from '../config/api';

let cached: Promise<BootstrapApp> | null = null;
let cachedUrl: string | null = null;

export function getBootstrap(): Promise<BootstrapApp> {
  const urlActual = obtenerApiBaseUrl();

  // Invalida cache si la IP cambio (ej: cambio de red WiFi)
  if (cachedUrl !== null && cachedUrl !== urlActual) {
    cached = null;
    cachedUrl = null;
  }

  if (!cached) {
    cachedUrl = urlActual;
    cached = bootstrapApp().catch((err) => {
      // Reseteamos el cache para que el proximo intento dispare un
      // bootstrap nuevo en vez de devolver siempre el error viejo.
      cached = null;
      cachedUrl = null;
      throw err;
    });
  }
  return cached;
}

/** Alias semántico usado por los servicios de aplicación móviles. */
export const obtenerBootstrap = getBootstrap;

// Test seam: permite a los tests resetear el cache entre casos.
export function __resetearCacheBootstrap(): void {
  cached = null;
  cachedUrl = null;
}
