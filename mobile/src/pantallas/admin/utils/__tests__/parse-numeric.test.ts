/**
 * Tests unitarios del helper parse-numeric.
 *
 * Cubre los 4 files que antes duplicaban los helpers:
 *   - mobile/src/pantallas/admin/parametros-tarifa-build-borrador.ts
 *   - mobile/src/pantallas/admin/hooks/useParametrosFormState.ts
 *   - mobile/src/pantallas/admin/componentes/ParametrosTarifaIPC.tsx
 *   - mobile/src/pantallas/admin/componentes/ParametrosTarifaAltitud.tsx
 *
 * Cleanup F2 del verify-report de `parametros-tarifa-screen-decomposition`.
 */

import { parseNum, parseEntero } from '../parse-numeric';

describe('parse-numeric helpers', () => {
  describe('parseNum', () => {
    it.each([
      ['0', 0],
      ['123', 123],
      ['123.45', 123.45],
      ['-123.45', -123.45],
      ['0.5', 0.5],
      ['1e3', 1000],
    ])('parseNum(%j) === %d', (input, expected) => {
      expect(parseNum(input)).toBe(expected);
    });

    it.each(['', '   ', 'abc', 'NaN', 'undefined', 'null'])(
      'parseNum(%j) colapsa a 0 (caso degenerado)',
      (input) => {
        expect(parseNum(input)).toBe(0);
      },
    );

    it('parseNum("12abc") lee prefijo numerico (JS semantics de parseFloat)', () => {
      // parseFloat('12abc') === 12 (parseFloat lee hasta el primer no-digit).
      // Matchea exactamente el comportamiento del codigo original
      // duplicado en los 4 archivos antes del refactor.
      expect(parseNum('12abc')).toBe(12);
    });

    it('parseNum("1e1000") colapsa Infinity a 0', () => {
      // parseFloat('1e1000') === Infinity, isFinite(Infinity) === false → 0
      expect(parseNum('1e1000')).toBe(0);
    });
  });

  describe('parseEntero', () => {
    it.each([
      ['0', 0],
      ['42', 42],
      ['-7', -7],
      ['100', 100],
    ])('parseEntero(%j) === %d', (input, expected) => {
      expect(parseEntero(input)).toBe(expected);
    });

    it('parseEntero trunca decimales a integer (parseInt base 10)', () => {
      expect(parseEntero('42.7')).toBe(42);
      expect(parseEntero('42.9')).toBe(42);
    });

    it.each(['', '   ', 'abc', 'NaN', 'undefined', 'null'])(
      'parseEntero(%j) colapsa a 0 (caso degenerado)',
      (input) => {
        expect(parseEntero(input)).toBe(0);
      },
    );

    it('parseEntero("12abc") lee prefijo numerico (JS semantics de parseInt)', () => {
      // parseInt('12abc', 10) === 12 (parseInt lee hasta el primer no-digit).
      // Matchea exactamente el comportamiento del codigo original
      // duplicado en los 4 archivos antes del refactor.
      expect(parseEntero('12abc')).toBe(12);
    });

    it('parseEntero("1e1000") lee solo el prefijo (parseInt no entiende notacion cientifica)', () => {
      // parseInt('1e1000', 10) === 1 (parseInt no parsea exponentes, lee
      // solo el primer segmento numerico). El numero que SALE es finito,
      // asi que isFinite pasa y retorna 1. Esto matchea el codigo
      // original duplicado.
      expect(parseEntero('1e1000')).toBe(1);
    });

    it('parseEntero("Infinity") colapsa NaN a 0', () => {
      // parseInt('Infinity', 10) === NaN (parseInt no parsea el literal
      // "Infinity" como numero). isFinite(NaN) === false → 0.
      expect(parseEntero('Infinity')).toBe(0);
    });
  });
});
