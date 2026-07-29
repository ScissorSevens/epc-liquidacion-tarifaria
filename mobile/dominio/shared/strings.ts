/**
 * Helpers de normalizacion de strings para snapshots y serializacion.
 *
 * `nullIfEmpty` y `nullIfEmptyOrWhitespace` resuelven el patron repetido
 * en el dominio de factura y lectura:
 *   campo: string | undefined  →  snapshot.campo: string | null
 *
 * El snapshot normativo (Res CRA 1038/2026) NO admite `undefined`:
 * siempre expone la clave, con `null` si el origen no la trae. Estos
 * helpers centralizan la conversion para evitar 10+ duplicaciones del
 * patron `=== undefined || === ''`.
 *
 * Ver code review 2026-07-29 (#875) — patron repetido en `factura.ts`
 * y `types.ts`. Antes de este helper, cada call site tenia su propia
 * copia de la misma logica (3-line ternario).
 */

/**
 * Convierte `undefined`, `null` o `''` a `null`. Preserva el string
 * original (incluyendo whitespace interno) cuando no esta vacio.
 *
 * Caso de uso tipico: snapshot de campos opcionales del origen
 * (`suscriptor.email`, `lectura.observaciones`, `prestador.representante_legal`).
 *
 * @param s Valor origen (puede ser `undefined`, `null` o string)
 * @returns `null` si el valor es vacio o ausente; el string original en otro caso
 *
 * @example
 *   nullIfEmpty(undefined)  // null
 *   nullIfEmpty('')          // null
 *   nullIfEmpty('abc')       // 'abc'
 *   nullIfEmpty('  ')        // '  '  (preserva whitespace intencional)
 */
export function nullIfEmpty(s: string | undefined | null): string | null {
  if (s === undefined || s === null || s === '') {
    return null;
  }
  return s;
}

/**
 * Variante que tambien normaliza strings compuestos solo por whitespace
 * (`' '`, `'\t'`, `'\n'`) a `null`. Util cuando el campo representa
 * "texto real escrito por el usuario" y un valor en blanco no
 * deberia sobrevivir al snapshot.
 *
 * NO usar en campos donde el whitespace podria ser semantico (ej:
 * `sector: ' '` con un solo espacio como placeholder valido en algun
 * sistema legacy). Para ese caso, usar `nullIfEmpty`.
 *
 * @param s Valor origen (puede ser `undefined`, `null` o string)
 * @returns `null` si el valor es vacio, ausente o solo whitespace; el string trimmed en otro caso
 *
 * @example
 *   nullIfEmptyOrWhitespace(undefined)  // null
 *   nullIfEmptyOrWhitespace('')         // null
 *   nullIfEmptyOrWhitespace('  ')       // null
 *   nullIfEmptyOrWhitespace('abc')      // 'abc'
 *   nullIfEmptyOrWhitespace('  abc  ')  // 'abc'
 */
export function nullIfEmptyOrWhitespace(s: string | undefined | null): string | null {
  if (s === undefined || s === null) {
    return null;
  }
  const trimmed = s.trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed;
}
