/**
 * Mapper de errores SQLite → errores tipados de infra.
 *
 * Arquitectura hexagonal (D9):
 * - Este mapper vive en infra; habla CÓDIGOS, no mensajes de dominio.
 * - El adapter (Phase 7) captura estos errores, lee `cause.codigo` y traduce
 *   al mensaje de `MENSAJES_ERROR_FACTURA` correspondiente.
 *
 * Set canónico de códigos (Batch 1 — solo TRANSICION_ILEGAL implementado;
 * resto se agrega en cycles 2.4.2 y 2.4.3 como triangulations):
 * - TRANSICION_ILEGAL          → SQLITE_CONSTRAINT_CHECK con ctx.tabla='factura' y mensaje sobre `estado`
 * - RESTRICCION_UNICIDAD       → SQLITE_CONSTRAINT_UNIQUE
 * - CAMPO_REQUERIDO            → SQLITE_CONSTRAINT_NOTNULL
 * - RESTRICCION_INTEGRIDAD     → cualquier otro SQLITE_CONSTRAINT_*
 * - ERROR_PERSISTENCIA         → resto (BUSY, LOCKED, IOERR, …)
 */

export type CodigoErrorPersistencia =
  | 'TRANSICION_ILEGAL'
  | 'RESTRICCION_UNICIDAD'
  | 'CAMPO_REQUERIDO'
  | 'RESTRICCION_INTEGRIDAD'
  | 'ERROR_PERSISTENCIA';

export interface CauseErrorPersistencia {
  readonly codigo: CodigoErrorPersistencia;
  readonly sqliteCode: string;
  readonly ctx?: { readonly tabla?: string; readonly columna?: string; readonly [k: string]: unknown };
}

export interface ErrorPersistencia extends Error {
  readonly cause: CauseErrorPersistencia;
}

interface SqliteErrorLike {
  readonly code: string;
  readonly message: string;
}

function esSqliteErrorLike(err: unknown): err is SqliteErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

export function mapearErrorSqlite(
  err: unknown,
  ctx?: { readonly tabla?: string },
): ErrorPersistencia {
  if (!esSqliteErrorLike(err)) {
    // no es un SqliteError → wrapper genérico
    const error = new Error('error de persistencia desconocido') as ErrorPersistencia;
    Object.defineProperty(error, 'cause', {
      value: { codigo: 'ERROR_PERSISTENCIA', sqliteCode: 'UNKNOWN', ctx },
      enumerable: true,
    });
    return error;
  }

  const { code, message } = err;

  // CHECK constraint en factura sobre columna estado → TRANSICION_ILEGAL
  if (
    code === 'SQLITE_CONSTRAINT_CHECK' &&
    ctx?.tabla === 'factura' &&
    /\bestado\b/i.test(message)
  ) {
    const error = new Error('violación de constraint en SQLite (CHECK)') as ErrorPersistencia;
    Object.defineProperty(error, 'cause', {
      value: { codigo: 'TRANSICION_ILEGAL', sqliteCode: code, ctx },
      enumerable: true,
    });
    return error;
  }

  // UNIQUE constraint (incluye índice UNIQUE parcial) → RESTRICCION_UNICIDAD
  if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const error = new Error('violación de unicidad en SQLite') as ErrorPersistencia;
    Object.defineProperty(error, 'cause', {
      value: { codigo: 'RESTRICCION_UNICIDAD', sqliteCode: code, ctx },
      enumerable: true,
    });
    return error;
  }

  // fallback temporal — se completa en 2.4.2 / 2.4.3
  const error = new Error('error de persistencia') as ErrorPersistencia;
  Object.defineProperty(error, 'cause', {
    value: { codigo: 'ERROR_PERSISTENCIA', sqliteCode: code, ctx },
    enumerable: true,
  });
  return error;
}
