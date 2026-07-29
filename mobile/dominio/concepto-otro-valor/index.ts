/**
 * Barrel exports del modulo `concepto-otro-valor`.
 *
 * `factura-compliance-cleanup` Task 6 anade `factory.ts` (factory
 * pura para `ConceptoOtroValor`) y `errors.ts` (errores de dominio
 * con tipo para `instanceof` checks) al modulo.
 */
export {
  type ConceptoOtroValor,
  type ConceptoOtroValorRepository,
  type CodigoConceptoOtroValor,
  CATALOGO_VERSION_INICIAL,
  CODIGOS_CONCEPTO_OTRO_VALOR,
  DESCRIPCIONES_CONCEPTO_OTRO_VALOR,
} from './types';
export { crearConceptoOtroValor, type CrearConceptoOtroValorInput } from './factory';
export {
  ConceptoOtroValorNoEncontradoError,
  ConceptoOtroValorInactivoError,
} from './errors';
