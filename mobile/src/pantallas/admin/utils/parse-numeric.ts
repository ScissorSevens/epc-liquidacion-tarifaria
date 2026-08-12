/**
 * Helpers de parseo numerico seguros para inputs de form (strings).
 *
 * Módulo puro, sin dependencias. Se usa en todos los forms del
 * proyecto que reciben texto del usuario y necesitan coercion a
 * number (PantallaTarifa, subcomponentes de sección, etc.).
 *
 * Conveccion del proyecto: `parseFloat` / `parseInt` sin protección
 * pueden devolver `NaN` para inputs vacios, no-numericos o
 * malformados. Eso se propaga como `NaN` a `JSON.stringify` en la
 * persistencia, lo que el backend rechaza como 400. Estos helpers
 * colapsan cualquier caso degenerado a `0` para mantener el round-trip
 * robusto sin necesidad de try/catch en cada callsite.
 *
 * Por que `Number.isFinite(n)` y no `isNaN(n)`:
 *   - `Number.isFinite` cubre AMBOS casos: `NaN` y `Infinity` / `-Infinity`.
 *   - `isNaN` solo cubre `NaN` (un `parseFloat('1e1000')` devuelve `Infinity`,
 *     que `isNaN` considera numero valido).
 *   - Cobertura consistente con `buildBorradorLocal` y `validarTodo`
 *     que usan `Number.isFinite` en el resto del codebase.
 */

/**
 * Parsea un string a number con decimales. NaN, empty, Infinity → 0.
 *
 * Casos:
 *   - parseNum('0')      → 0
 *   - parseNum('123.45') → 123.45
 *   - parseNum('abc')    → 0
 *   - parseNum('')       → 0
 *   - parseNum('1e1000')  → 0  (Infinity colapsado)
 */
export function parseNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parsea un string a integer. NaN, empty, Infinity → 0.
 *
 * Casos:
 *   - parseEntero('0')      → 0
 *   - parseEntero('42')     → 42
 *   - parseEntero('42.7')   → 42  (truncado por parseInt con base 10)
 *   - parseEntero('abc')    → 0
 *   - parseEntero('')       → 0
 *   - parseEntero('1e1000') → 0  (Infinity colapsado)
 */
export function parseEntero(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
