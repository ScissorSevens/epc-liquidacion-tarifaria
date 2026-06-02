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
    // no es un SqliteError (sin .code) → wrapper genérico
    return construirError('error de persistencia desconocido', 'ERROR_PERSISTENCIA', 'UNKNOWN', ctx);
  }

  const { code, message } = err;

  // CHECK constraint en factura sobre columna estado → TRANSICION_ILEGAL
  if (
    code === 'SQLITE_CONSTRAINT_CHECK' &&
    ctx?.tabla === 'factura' &&
    /\bestado\b/i.test(message)
  ) {
    return construirError(
      'violación de constraint en SQLite (CHECK)',
      'TRANSICION_ILEGAL',
      code,
      ctx,
    );
  }

  // NOT NULL → CAMPO_REQUERIDO
  if (code === 'SQLITE_CONSTRAINT_NOTNULL') {
    return construirError('campo requerido sin valor', 'CAMPO_REQUERIDO', code, ctx);
  }

  // UNIQUE (incluye índices UNIQUE parciales) → RESTRICCION_UNICIDAD
  if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return construirError('violación de unicidad en SQLite', 'RESTRICCION_UNICIDAD', code, ctx);
  }

  // catch-all de constraints (FK, PRIMARYKEY, CHECK no reconocido, etc.)
  if (code.startsWith('SQLITE_CONSTRAINT')) {
    return construirError(
      'violación de integridad en SQLite',
      'RESTRICCION_INTEGRIDAD',
      code,
      ctx,
    );
  }

  // resto (BUSY, LOCKED, IOERR, …) → wrapper genérico
  return construirError('error de persistencia', 'ERROR_PERSISTENCIA', code, ctx);
}

function construirError(
  mensaje: string,
  codigo: CodigoErrorPersistencia,
  sqliteCode: string,
  ctx?: { readonly tabla?: string },
): ErrorPersistencia {
  const error = new Error(mensaje) as ErrorPersistencia;
  Object.defineProperty(error, 'cause', {
    value: { codigo, sqliteCode, ctx },
    enumerable: true,
  });
  return error;
}
