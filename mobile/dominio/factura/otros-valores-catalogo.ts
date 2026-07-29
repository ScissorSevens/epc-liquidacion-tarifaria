/**
 * Tipo `OtroValor` del modulo factura.
 *
 * Este archivo queda reducido a tipos puros despues del phase-out de
 * `OtrosValoresCatalogo` y `crearOtroValor` (efectuado por
 * `factura-compliance-cleanup` Task 5). El catalogo regulatorio de
 * conceptos vive ahora en la tabla SQLite `concepto_otro_valor` (seed
 * via migration 021) y se valida exclusivamente por la ruta async de
 * `emitirFactura` (con `catalogoRepo` inyectado).
 *
 * Cambios concretos del phase-out:
 *  - Eliminado `OtrosValoresCatalogo` (constant hardcoded con los
 *    7 conceptos Res CRA 1038/2026). Su unico uso en produccion era
 *    la validacion del path sync de `emitirFactura`, que ahora es
 *    "trust the caller" (ver `emitirFacturaSync` JSDoc).
 *  - Eliminado `crearOtroValor` helper. Validaba `concepto` contra
 *    `OtrosValoresCatalogo` (ya no existe) y `valor`/`glosa` con
 *    reglas que ahora se aplican via `crearConceptoOtroValor` en el
 *    modulo `concepto-otro-valor` (ver `factura-compliance-cleanup`
 *    Task 6). Para construir un `OtroValor` en tests/UI, instanciar
 *    el type directamente: `{ concepto: 'RECONEXION', valor: 1000 }`.
 *
 * El type `ConceptoOtroValor` (los 7 codigos canonicos) sigue
 * exportado para que los tipos del snapshot se mantengan
 * retrocompatibles.
 */

export type ConceptoOtroValor =
  | 'SALDO_ANTERIOR'
  | 'INTERESES_AUTORIZADOS'
  | 'RECONEXION'
  | 'FINANCIACION'
  | 'MATERIALES_ACOMETIDA'
  | 'AJUSTES_DEVOLUCIONES'
  | 'OTROS_AUTORIZADOS';

export interface OtroValor {
  readonly concepto: ConceptoOtroValor;
  readonly valor: number;
  readonly glosa?: string;
}
