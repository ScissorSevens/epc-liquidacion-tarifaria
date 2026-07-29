/**
 * Factory pura para `ConceptoOtroValor`.
 *
 * Antes de este archivo, los callers (ej: `factura-compliance-hardening`
 * Task 8 con la UI `OtrosValoresFactura`) construian el concepto
 * directamente via `Omit<ConceptoOtroValor, 'idConcepto' | 'createdAt'>`
 * con casts a `as ConceptoOtroValor` para evitar errores de TypeScript.
 * Eso permitia inputs incompletos (sin `version`, sin `activo`,
 * `requiereGlosa` mal seteado) que solo se detectaban en runtime.
 *
 * Esta factory centraliza las validaciones de shape y delega el
 * `idConcepto`/`createdAt` al caller (esos son del adapter SQLite,
 * no del dominio puro).
 *
 * Diseno:
 *  - `crearConceptoOtroValor(input)` retorna un `ConceptoOtroValor` con
 *    `idConcepto: 0` y `createdAt: ''` como placeholders. El adapter
 *    SQLite los reemplaza al persistir.
 *  - Validaciones: `codigo` ∈ `CODIGOS_CONCEPTO_OTRO_VALOR`, `version`
 *    no vacio, `descripcion` no vacia, `activo` boolean, `requiereGlosa`
 *    boolean. Falla rapido con `Error` descriptivo.
 *  - Determinista: mismo input → mismo output. Pure function.
 *  - Inmutable: retorna objeto deepFrozen.
 *
 * NO es responsable de validar contra la DB (eso lo hace el repo
 * con `buscarPorCodigo` + `instanceof ConceptoOtroValorNoEncontradoError`).
 *
 * @see `errors.ts` para los errores de dominio
 * @see `types.ts` para el shape y el repo port
 */

import {
  CODIGOS_CONCEPTO_OTRO_VALOR,
  CATALOGO_VERSION_INICIAL,
  type CodigoConceptoOtroValor,
  type ConceptoOtroValor,
} from './types';

/**
 * Input para `crearConceptoOtroValor`. `idConcepto` y `createdAt` se
 * omiten porque son del adapter de persistencia (SQLite los asigna al
 * INSERT). El caller que construye un concepto en memoria para tests
 * o fixtures no necesita setearlos.
 */
export interface CrearConceptoOtroValorInput {
  readonly codigo: CodigoConceptoOtroValor;
  readonly descripcion: string;
  readonly version?: string;
  readonly activo: boolean;
  readonly requiereGlosa: boolean;
}

/**
 * Crea un `ConceptoOtroValor` validado.
 *
 * @throws `Error` si:
 *  - `codigo` no es uno de los `CODIGOS_CONCEPTO_OTRO_VALOR` (lista
 *    cerrada de Res CRA 1038/2026).
 *  - `descripcion` es vacia.
 *  - `version` (si se provee) es vacia.
 *
 * Los flags `activo` y `requiereGlosa` se asumen boolean — TypeScript
 * los valida estaticamente, pero si el caller hace `as` cast con
 * `unknown` el dominio confia en el input (es responsabilidad del
 * adapter, no de la factory, detectar flags no booleanos).
 */
export function crearConceptoOtroValor(
  input: CrearConceptoOtroValorInput,
): ConceptoOtroValor {
  // codigo ∈ CODIGOS_CONCEPTO_OTRO_VALOR
  if (!(CODIGOS_CONCEPTO_OTRO_VALOR as readonly string[]).includes(input.codigo)) {
    throw new Error(
      `crearConceptoOtroValor: codigo '${input.codigo}' no esta en la lista regulatoria cerrada`,
    );
  }
  // descripcion no vacia
  if (input.descripcion === undefined || input.descripcion.trim() === '') {
    throw new Error('crearConceptoOtroValor: descripcion es requerida');
  }
  // version: si se provee, no vacia
  const version = input.version ?? CATALOGO_VERSION_INICIAL;
  if (version === undefined || version.trim() === '') {
    throw new Error('crearConceptoOtroValor: version no puede ser vacia');
  }
  const concepto: ConceptoOtroValor = Object.freeze({
    idConcepto: 0,
    codigo: input.codigo,
    descripcion: input.descripcion.trim(),
    version: version.trim(),
    activo: input.activo,
    requiereGlosa: input.requiereGlosa,
    createdAt: '',
  });
  return concepto;
}
