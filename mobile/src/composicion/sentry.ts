/**
 * Wrapper de Sentry para el logger centralizado.
 *
 * El logger (logger.ts) intenta capturar mensajes via Sentry cuando
 * el app está en producción. Si Sentry no está configurado (DSN vacío),
 * el logger silenciosamente hace no-op.
 *
 * TICKET-P1.6: cuando se instale sentry-expo y se configure el DSN,
 * reemplazar el `null` por `import * as Sentry from 'sentry-expo'`.
 */

interface SentryLike {
  captureMessage?: (msg: string, level: 'debug' | 'info' | 'warn' | 'error') => void;
  captureException?: (err: unknown) => void;
}

// Placeholder: cuando se instale Sentry, importar el modulo real y
// castearlo a este shape. Mientras tanto, null = no-op.
export const Sentry: SentryLike | null = null;
