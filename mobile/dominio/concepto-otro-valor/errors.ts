/**
 * Errores de dominio del modulo `concepto-otro-valor`.
 *
 * Antes de este archivo, los errores se emitian como `Error('mensaje')`
 * generico desde el repository o desde las funciones que lo consumian
 * (ej: `emitirFacturaAsync` lanzaba `Error(MENSAJES_ERROR_FACTURA.X)`).
 * Eso impedía a los callers discriminar el tipo de error con
 * `instanceof` para flujo de UI o logging estructurado.
 *
 * Las clases aqui son errores de DOMINIO, no de INFRAESTRUCTURA:
 * representan condiciones regulatorias o de negocio, no fallos de
 * IO o SQL. Los adapters SQLite pueden mapear errores de SQLite a
 * estos (ej: `buscarPorCodigo` retorna `null`, los callers
 * traducen a `ConceptoOtroValorNoEncontradoError` cuando aplica).
 *
 * Tests: `__tests__/concepto-otro-valor-errors.test.ts`.
 */

/**
 * El codigo de concepto solicitado no existe en el catalogo
 * (o el adapter no lo encontro). Lanzada por funciones que reciben
 * un codigo externo y necesitan garantizar su presencia — ej:
 * `crearConceptoOtroValor(input)` cuando el caller quiere validar
 * contra el catalogo vigente.
 *
 * Carry del codigo solicitado en `cause` para que el caller pueda
 * loggear o mostrar feedback al operario.
 */
export class ConceptoOtroValorNoEncontradoError extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje?: string) {
    super(
      mensaje ??
        `concepto de otro valor con codigo '${codigo}' no encontrado en el catalogo`,
    );
    this.name = 'ConceptoOtroValorNoEncontradoError';
    this.codigo = codigo;
    Object.setPrototypeOf(this, ConceptoOtroValorNoEncontradoError.prototype);
  }
}

/**
 * El codigo existe en el catalogo pero esta marcado `activo=false`
 * (regulatoriamente deshabilitado, pero conservado para auditoria
 * historica). El caller debe rechazar el uso de este concepto en
 * la emision de factura.
 *
 * Tests: cubre el caso donde la regulacion posterior desactiva un
 * codigo (ej: migration 022 con `activo=0` para INTERESES_AUTORIZADOS)
 * y el caller intenta usarlo.
 */
export class ConceptoOtroValorInactivoError extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje?: string) {
    super(
      mensaje ??
        `concepto de otro valor con codigo '${codigo}' esta inactivo en el catalogo`,
    );
    this.name = 'ConceptoOtroValorInactivoError';
    this.codigo = codigo;
    Object.setPrototypeOf(this, ConceptoOtroValorInactivoError.prototype);
  }
}
