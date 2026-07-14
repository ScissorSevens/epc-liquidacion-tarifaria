/**
 * Logger centralizado de la app mobile.
 *
 * Por que existe:
 *   - `console.warn`/`console.log` van al bundle de producción
 *     (Metro no hace DCE por default) y pueden leakear info sensible
 *     (cédulas, IDs, paths).
 *   - TICKET-P1.7: necesitamos un logger que en dev imprima en consola
 *     pero en prod se silencie (o se envie a Sentry cuando esté
 *     configurado, ticket P1.6).
 *
 * Uso:
 *   import { logger } from '../composicion/logger';
 *   logger.warn('Pantalla', 'mensaje contextual', { extra });
 *   logger.error('Pantalla', 'error mensaje', error);
 *
 * En dev imprime via console nativo. En prod silencia (futuro: Sentry).
 */

import { Sentry } from './sentry';

const ENABLED = __DEV__;

type Nivel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(scope: string, message: string, extra?: Record<string, unknown>): void;
  info(scope: string, message: string, extra?: Record<string, unknown>): void;
  warn(scope: string, message: string, extra?: Record<string, unknown>): void;
  error(scope: string, message: string, err?: unknown, extra?: Record<string, unknown>): void;
}

function fmt(scope: string, level: Nivel, message: string, extra?: Record<string, unknown>): unknown[] {
  const prefix = `[${scope}]`;
  if (extra && Object.keys(extra).length > 0) {
    return [prefix, message, extra];
  }
  return [prefix, message];
}

function emit(level: Nivel, args: unknown[]): void {
  if (!ENABLED) {
    // En producción: silenciar (futuro: enviar a Sentry).
    // Por ahora, swallow. Cuando Sentry esté configurado, reemplazar.
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(args.map(String).join(' '), level);
    }
    return;
  }
  // En dev: pasar al console nativo.
  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(...(args as Parameters<typeof console.debug>));
      return;
    case 'info':
      // eslint-disable-next-line no-console
      console.info(...(args as Parameters<typeof console.info>));
      return;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(...(args as Parameters<typeof console.warn>));
      return;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(...(args as Parameters<typeof console.error>));
      return;
  }
}

export const logger: Logger = {
  debug: (scope, message, extra) => emit('debug', fmt(scope, 'debug', message, extra)),
  info: (scope, message, extra) => emit('info', fmt(scope, 'info', message, extra)),
  warn: (scope, message, extra) => emit('warn', fmt(scope, 'warn', message, extra)),
  error: (scope, message, err, extra) => {
    const args = fmt(scope, 'error', message, extra);
    if (err !== undefined) args.push(err);
    emit('error', args);
  },
};
