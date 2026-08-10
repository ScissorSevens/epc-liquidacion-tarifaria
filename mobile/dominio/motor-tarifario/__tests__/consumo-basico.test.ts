/**
 * Tests para `aplicarConsumoBasico` (Res CRA 750/2016 compliance).
 *
 * Reglas (Art. 3 Res CRA 750/2016):
 *   altitud > 2.000 msnm  → 11 m3/mes (limite basico)
 *   altitud 1.000-2.000 msnm → 13 m3/mes
 *   altitud ≤ 1.000 msnm  → 16 m3/mes
 *
 * Comportamiento esperado:
 *   - Consumo <= limite → todo es "basico", excedente = 0.
 *   - Consumo > limite → basico = limite, excedente = consumo - limite.
 *   - `periodo_meses` > 1: el limite se multiplica por el numero de
 *     meses del periodo (facturacion bimestral = limite x 2).
 *   - `altitud_msnm` null/undefined → fallback conservador a 16 m3.
 */

import { aplicarConsumoBasico, LIMITES_CONSUMO_BASICO_MS3 } from '../consumo-basico';

describe('LIMITES_CONSUMO_BASICO_MS3 (constante Res CRA 750/2016)', () => {
  it('mas2000 = 11 m3/mes', () => {
    expect(LIMITES_CONSUMO_BASICO_MS3.mas2000).toBe(11);
  });
  it('mil2000 = 13 m3/mes', () => {
    expect(LIMITES_CONSUMO_BASICO_MS3.mil2000).toBe(13);
  });
  it('mil1000 = 16 m3/mes', () => {
    expect(LIMITES_CONSUMO_BASICO_MS3.mil1000).toBe(16);
  });
});

describe('aplicarConsumoBasico', () => {
  describe('altitud > 2.000 msnm (limite 11 m3/mes)', () => {
    it('consumo bajo el limite (8 m3) → todo basico', () => {
      const r = aplicarConsumoBasico(8, 2600, 1);
      expect(r.basico).toBe(8);
      expect(r.excedente).toBe(0);
    });
    it('consumo en el limite exacto (11 m3) → todo basico', () => {
      const r = aplicarConsumoBasico(11, 2600, 1);
      expect(r.basico).toBe(11);
      expect(r.excedente).toBe(0);
    });
    it('consumo sobre el limite (25 m3, caso de la guia) → 11 basico + 14 excedente', () => {
      const r = aplicarConsumoBasico(25, 2600, 1);
      expect(r.basico).toBe(11);
      expect(r.excedente).toBe(14);
    });
  });

  describe('altitud 1.000-2.000 msnm (limite 13 m3/mes)', () => {
    it('consumo 25 m3 → 13 basico + 12 excedente', () => {
      const r = aplicarConsumoBasico(25, 1500, 1);
      expect(r.basico).toBe(13);
      expect(r.excedente).toBe(12);
    });
    it('consumo en el limite exacto (13 m3) → todo basico', () => {
      const r = aplicarConsumoBasico(13, 1500, 1);
      expect(r.basico).toBe(13);
      expect(r.excedente).toBe(0);
    });
  });

  describe('altitud ≤ 1.000 msnm (limite 16 m3/mes)', () => {
    it('consumo 25 m3 → 16 basico + 9 excedente', () => {
      const r = aplicarConsumoBasico(25, 800, 1);
      expect(r.basico).toBe(16);
      expect(r.excedente).toBe(9);
    });
    it('consumo en el limite exacto (16 m3) → todo basico', () => {
      const r = aplicarConsumoBasico(16, 800, 1);
      expect(r.basico).toBe(16);
      expect(r.excedente).toBe(0);
    });
  });

  describe('altitud null/undefined (fallback conservador)', () => {
    it('altitud null → usa limite 16 m3/mes (≤ 1.000)', () => {
      const r = aplicarConsumoBasico(25, null, 1);
      expect(r.basico).toBe(16);
      expect(r.excedente).toBe(9);
    });
    it('altitud undefined → usa limite 16 m3/mes (≤ 1.000)', () => {
      const r = aplicarConsumoBasico(20, undefined, 1);
      expect(r.basico).toBe(16);
      expect(r.excedente).toBe(4);
    });
  });

  describe('periodo multi-mes', () => {
    it('periodo_meses = 2 (bimestral) → limite x 2', () => {
      // altitud >2.000 → 11 m3/mes, 2 meses → 22 m3 limite
      const r = aplicarConsumoBasico(30, 2600, 2);
      expect(r.basico).toBe(22);
      expect(r.excedente).toBe(8);
    });
    it('periodo_meses = 6 (semestral) → limite x 6', () => {
      // altitud ≤1.000 → 16 m3/mes, 6 meses → 96 m3 limite
      const r = aplicarConsumoBasico(100, 800, 6);
      expect(r.basico).toBe(96);
      expect(r.excedente).toBe(4);
    });
  });

  describe('consumo cero', () => {
    it('consumo 0 → basico 0, excedente 0', () => {
      const r = aplicarConsumoBasico(0, 2600, 1);
      expect(r.basico).toBe(0);
      expect(r.excedente).toBe(0);
    });
  });

  describe('consumo negativo (validacion)', () => {
    it('consumo negativo lanza error', () => {
      expect(() => aplicarConsumoBasico(-1, 2600, 1)).toThrow();
    });
  });

  describe('boundary altitudes', () => {
    it('altitud exactamente 2.000 → limite 13 (no entra en mas2000 estricto)', () => {
      const r = aplicarConsumoBasico(13, 2000, 1);
      expect(r.basico).toBe(13);
      expect(r.excedente).toBe(0);
    });
    it('altitud exactamente 1.000 → limite 16 (no entra en mil2000 estricto)', () => {
      const r = aplicarConsumoBasico(16, 1000, 1);
      expect(r.basico).toBe(16);
      expect(r.excedente).toBe(0);
    });
    it('altitud 2.001 → limite 11 (entra en mas2000)', () => {
      const r = aplicarConsumoBasico(11, 2001, 1);
      expect(r.basico).toBe(11);
      expect(r.excedente).toBe(0);
    });
  });
});