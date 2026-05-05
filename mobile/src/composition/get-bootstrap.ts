// Helper singleton para acceder al BootstrapApp desde cualquier pantalla.
//
// `bootstrapApp()` abre la DB SQLite y aplica migraciones — es caro y NO
// debe ejecutarse en cada montaje. Cacheamos la PROMESA (no el resultado)
// para que multiples pantallas que pidan el bootstrap en paralelo durante
// el primer arranque compartan la misma inicializacion en lugar de
// dispararla N veces.
//
// Patron: lazy-init memoizada. Si la promesa rechaza, dejamos que el
// caller maneje el error (try/catch en la pantalla) y reseteamos el cache
// para permitir un retry posterior.

import { bootstrapApp, type BootstrapApp } from './bootstrap';

let cached: Promise<BootstrapApp> | null = null;

export function getBootstrap(): Promise<BootstrapApp> {
  if (!cached) {
    cached = bootstrapApp().catch((err) => {
      // Reseteamos el cache para que el proximo intento dispare un
      // bootstrap nuevo en vez de devolver siempre el error viejo.
      cached = null;
      throw err;
    });
  }
  return cached;
}
