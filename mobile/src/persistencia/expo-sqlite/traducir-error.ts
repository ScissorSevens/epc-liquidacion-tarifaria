/**
 * Traduccion de errores expo-sqlite -> codigos de dominio.
 *
 * NOTA SOBRE DUPLICACION (intencional):
 * En el adapter Node (`src/persistencia/sqlite/errores.ts`) tenemos
 * `mapearErrorSqlite`, que es PURO y deberia ser reusable. Pero
 * better-sqlite3 expone `err.code` como string discreto
 * (`SQLITE_CONSTRAINT_UNIQUE`, `SQLITE_CONSTRAINT_FOREIGNKEY`, etc.),
 * mientras que expo-sqlite NO expone codigos discretos: tira `Error`
 * comunes con substring tipo "UNIQUE constraint failed" o "FOREIGN KEY
 * constraint failed" embebido en `.message`. La logica de detecion es
 * intrinsecamente distinta — no se puede compartir el mapper. Esta
 * implementacion espeja la TABLA DE MAPEOS (los mismos 5 codigos:
 * RESTRICCION_UNICIDAD, RESTRICCION_INTEGRIDAD, CAMPO_REQUERIDO,
 * TRANSICION_ILEGAL, ERROR_PERSISTENCIA), pero la deteccion va por
 * substring case-insensitive del mensaje. Si el adapter Node agrega
 * un nuevo codigo, hay que reflejarlo aca a mano.
 *
 * Gotcha conocido expo-sqlite: el wrapper nativo a veces antepone
 * "Call to function ... rejected" antes del mensaje real de SQLite,
 * por eso siempre buscamos por substring y nunca por equals.
 */

export type CodigoErrorPersistencia =
  | 'TRANSICION_ILEGAL'
  | 'RESTRICCION_UNICIDAD'
  | 'CAMPO_REQUERIDO'
  | 'RESTRICCION_INTEGRIDAD'
  | 'ERROR_PERSISTENCIA';

export interface CauseErrorPersistencia {
  readonly codigo: CodigoErrorPersistencia;
  readonly ctx?: { readonly tabla?: string; readonly [k: string]: unknown };
}

export interface ErrorPersistencia extends Error {
  readonly cause: CauseErrorPersistencia;
}

/**
 * Detecta el tipo de violacion SQLite por substring del mensaje.
 * Devuelve un `ErrorPersistencia` con `cause.codigo` poblado para que
 * los adapters puedan traducir a mensajes de dominio especificos.
 */
export function mapearErrorExpoSqlite(
  err: unknown,
  ctx?: { readonly tabla?: string },
): ErrorPersistencia {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('unique constraint failed')) {
    return construirError('violacion de unicidad en SQLite', 'RESTRICCION_UNICIDAD', ctx);
  }

  if (lower.includes('foreign key constraint failed')) {
    return construirError('violacion de integridad referencial en SQLite', 'RESTRICCION_INTEGRIDAD', ctx);
  }

  if (lower.includes('not null constraint failed')) {
    return construirError('campo requerido sin valor', 'CAMPO_REQUERIDO', ctx);
  }

  // CHECK sobre `estado` en factura -> TRANSICION_ILEGAL (espeja la
  // logica del mapper Node).
  if (
    lower.includes('check constraint failed') &&
    ctx?.tabla === 'factura' &&
    /\bestado\b/i.test(msg)
  ) {
    return construirError('violacion de constraint en SQLite (CHECK)', 'TRANSICION_ILEGAL', ctx);
  }

  // catch-all de constraints no reconocidos -> integridad generica.
  if (lower.includes('constraint failed')) {
    return construirError('violacion de integridad en SQLite', 'RESTRICCION_INTEGRIDAD', ctx);
  }

  return construirError('error de persistencia', 'ERROR_PERSISTENCIA', ctx);
}

function construirError(
  mensaje: string,
  codigo: CodigoErrorPersistencia,
  ctx?: { readonly tabla?: string },
): ErrorPersistencia {
  const error = new Error(mensaje) as ErrorPersistencia;
  Object.defineProperty(error, 'cause', {
    value: { codigo, ctx },
    enumerable: true,
  });
  return error;
}
