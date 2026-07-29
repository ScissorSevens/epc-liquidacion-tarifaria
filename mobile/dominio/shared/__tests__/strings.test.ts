/**
 * Tests de los helpers `nullIfEmpty` y `nullIfEmptyOrWhitespace`.
 *
 * TDD strict: este archivo se escribio ANTES de la implementacion para
 * validar el contrato. Cubre los 5+3 escenarios base de cada helper,
 * incluyendo el caso de preservacion de whitespace intencional en
 * `nullIfEmpty` (importante: NO es un trim).
 */
import { nullIfEmpty, nullIfEmptyOrWhitespace } from '../strings';

describe('nullIfEmpty — normalizacion a null', () => {
  it('undefined → null', () => {
    expect(nullIfEmpty(undefined)).toBeNull();
  });

  it('null → null', () => {
    expect(nullIfEmpty(null)).toBeNull();
  });

  it("'' → null", () => {
    expect(nullIfEmpty('')).toBeNull();
  });

  it("'abc' → 'abc' (preserva el string original)", () => {
    expect(nullIfEmpty('abc')).toBe('abc');
  });

  it("'  ' (whitespace puro) → '  ' (preserva whitespace intencional)", () => {
    // El helper NO trimea. Distinto de `nullIfEmptyOrWhitespace` abajo.
    expect(nullIfEmpty('  ')).toBe('  ');
  });

  it("' abc ' (whitespace alrededor de contenido) → ' abc ' (NO trimea)", () => {
    expect(nullIfEmpty(' abc ')).toBe(' abc ');
  });

  it("'0' (string que parece falsy) → '0' (preserva el string)", () => {
    // Distinguir de coercion booleana: '0' es un string no-vacio.
    expect(nullIfEmpty('0')).toBe('0');
  });
});

describe('nullIfEmptyOrWhitespace — normalizacion a null + trim', () => {
  it('undefined → null', () => {
    expect(nullIfEmptyOrWhitespace(undefined)).toBeNull();
  });

  it('null → null', () => {
    expect(nullIfEmptyOrWhitespace(null)).toBeNull();
  });

  it("'' → null", () => {
    expect(nullIfEmptyOrWhitespace('')).toBeNull();
  });

  it("'  ' (solo espacios) → null", () => {
    expect(nullIfEmptyOrWhitespace('  ')).toBeNull();
  });

  it("'\\t\\n' (whitespace mixto) → null", () => {
    expect(nullIfEmptyOrWhitespace('\t\n')).toBeNull();
  });

  it("'abc' → 'abc' (sin cambio)", () => {
    expect(nullIfEmptyOrWhitespace('abc')).toBe('abc');
  });

  it("'  abc  ' → 'abc' (trimea whitespace alrededor)", () => {
    expect(nullIfEmptyOrWhitespace('  abc  ')).toBe('abc');
  });
});
