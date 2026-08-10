/**
 * RED test para `validarAmbito` — gate pre-liquidación.
 * Cobertura de los 4 escenarios del spec `ambito-tarifario/spec.md`.
 *
 * Fase 2 (`param-tarifa-res-825-compliance-phase2`), task 1.2 RED.
 */

import { validarAmbito } from '../validar-ambito';

describe('validarAmbito — gate pre-liquidación (Res CRA 825/2017 + 1032/2026)', () => {
  // Fecha de referencia para todos los tests.
  const FECHA = '2026-08-10T10:00:00Z';

  describe('Escenario 1: prestador rural con ≤5.000 suscriptores', () => {
    it('retorna APLICA Subtítulo 2 con norma CRA 825/2017', () => {
      const r = validarAmbito(
        { id_prestador: 1, cantidad_suscriptores: 1200, zona: 'RURAL' },
        FECHA,
      );
      expect(r.estado).toBe('APLICA');
      expect(r.subtitulo).toBe(2);
      expect(r.normaAplicable).toBe('CRA_825_2017');
      expect(r.evidencia).toContain('1200');
      expect(r.evidencia).toContain('RURAL');
      expect(r.fecha_verificacion).toBe(FECHA);
    });
  });

  describe('Escenario 2: prestador urbano con >5.000 suscriptores', () => {
    it('retorna APLICA Subtítulo 1 con norma CRA 1032/2026 Subtítulo 1', () => {
      const r = validarAmbito(
        { id_prestador: 2, cantidad_suscriptores: 8500, zona: 'URBANA' },
        FECHA,
      );
      expect(r.estado).toBe('APLICA');
      expect(r.subtitulo).toBe(1);
      expect(r.normaAplicable).toBe('CRA_1032_2026_SUBTITULO_1');
      expect(r.evidencia).toContain('8500');
      expect(r.evidencia).toContain('URBANA');
    });
  });

  describe('Escenario 3: prestador urbano con ≤5.000 suscriptores', () => {
    it('retorna APLICA Subtítulo 2 (CRA 825/2017 sigue aplicando)', () => {
      const r = validarAmbito(
        { id_prestador: 3, cantidad_suscriptores: 4500, zona: 'URBANA' },
        FECHA,
      );
      expect(r.estado).toBe('APLICA');
      expect(r.subtitulo).toBe(2);
      expect(r.normaAplicable).toBe('CRA_825_2017');
    });
  });

  describe('Escenario 4: sin cantidad de suscriptores definida', () => {
    it('retorna INDETERMINADO con subtitulo=null', () => {
      const r = validarAmbito(
        { id_prestador: 4, cantidad_suscriptores: null, zona: 'RURAL' },
        FECHA,
      );
      expect(r.estado).toBe('INDETERMINADO');
      expect(r.subtitulo).toBe(null);
      expect(r.normaAplicable).toBe(null);
      expect(r.evidencia).toContain('cantidad_suscriptores_indefinida');
    });
  });

  describe('Escenario 5 (extra): MIXTA con >50% urbanos y >5.000 total', () => {
    it('retorna APLICA Subtítulo 1', () => {
      const r = validarAmbito(
        { id_prestador: 5, cantidad_suscriptores: 6000, zona: 'MIXTA' },
        FECHA,
      );
      expect(r.estado).toBe('APLICA');
      expect(r.subtitulo).toBe(1);
    });
  });

  describe('Escenario 6 (extra): MIXTA con mayoría rurales y ≤5.000', () => {
    it('retorna APLICA Subtítulo 2', () => {
      const r = validarAmbito(
        { id_prestador: 6, cantidad_suscriptores: 4000, zona: 'MIXTA' },
        FECHA,
      );
      expect(r.estado).toBe('APLICA');
      expect(r.subtitulo).toBe(2);
    });
  });
});
