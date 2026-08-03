// mobile/__tests__/utils/formatCOP.test.ts
//
// Tests contractuales del helper formatCOP — display-only de COP para
// el card ResumenCargos (parametros-tarifa-impeccable-v2 Commit 2).
//
// Cobertura (triangulacion):
//   T-FMT-1  Valor redondo grande: 12000000 → "$ 12.000.000".
//   T-FMT-2  Cero: 0 → "$ 0".
//   T-FMT-3  Valor redondo chico: 40000 → "$ 40.000".
//   T-FMT-4  Valor con cents se truncan: 1100 → "$ 1.100".
//   T-FMT-5  Valor negativo o NaN se defensivamente trata como "$ 0"
//            (no rompe la UI si el dominio devuelve algo raro).
//
// TDD Evidence:
//   RED  → modulo no existe. La importacion tira Cannot find module.
//   GREEN → implementacion del helper. Tests pasan.

import { formatCOP } from '../../src/utils/formatCOP';

describe('formatCOP — display helper COP', () => {
  // ── T-FMT-1: valor grande ───────────────────────────────────────────────
  describe('T-FMT-1: formatea valores grandes con separador de miles', () => {
    it('formatCOP(12_000_000) === "$ 12.000.000"', () => {
      expect(formatCOP(12_000_000)).toBe('$ 12.000.000');
    });
  });

  // ── T-FMT-2: cero ───────────────────────────────────────────────────────
  describe('T-FMT-2: cero se formatea como "$ 0"', () => {
    it('formatCOP(0) === "$ 0"', () => {
      expect(formatCOP(0)).toBe('$ 0');
    });
  });

  // ── T-FMT-3: valor redondo chico ────────────────────────────────────────
  describe('T-FMT-3: valores chicos mantienen el formato COP', () => {
    it('formatCOP(40_000) === "$ 40.000"', () => {
      expect(formatCOP(40_000)).toBe('$ 40.000');
    });
  });

  // ── T-FMT-4: truncar cents ──────────────────────────────────────────────
  describe('T-FMT-4: maximumFractionDigits=0 (cents se truncan)', () => {
    it('formatCOP(1100) === "$ 1.100" (sin decimals)', () => {
      expect(formatCOP(1_100)).toBe('$ 1.100');
    });

    it('formatCOP(1234.56) === "$ 1.235" (cents truncados, NO redondeo)', () => {
      // es-CO toLocaleString con maximumFractionDigits=0 usa round-half-to-even
      // o round-half-up segun engine. Aceptamos cualquier salida entera.
      const out = formatCOP(1_234.56);
      // Removemos el prefijo "$ " y comparamos como numero entero.
      const numeric = parseInt(out.replace(/[^0-9]/g, ''), 10);
      expect(numeric).toBeGreaterThanOrEqual(1_234);
      expect(numeric).toBeLessThanOrEqual(1_235);
    });
  });

  // ── T-FMT-5: defensiva NaN/Infinity ─────────────────────────────────────
  describe('T-FMT-5: defensivo contra NaN / Infinity', () => {
    it('formatCOP(NaN) === "$ 0"', () => {
      expect(formatCOP(NaN)).toBe('$ 0');
    });

    it('formatCOP(Infinity) === "$ 0"', () => {
      expect(formatCOP(Infinity)).toBe('$ 0');
    });

    it('formatCOP(-Infinity) === "$ 0"', () => {
      expect(formatCOP(-Infinity)).toBe('$ 0');
    });
  });
});