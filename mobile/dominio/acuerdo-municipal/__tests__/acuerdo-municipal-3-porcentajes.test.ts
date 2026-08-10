/**
 * Tests del modelo AcuerdoMunicipal con 3 porcentajes separados
 * (Res CRA 825/2017 + Res 750/2016 compliance).
 *
 * Cambios estructurales:
 *   - `factor_subsidio_e1/e2/e3` (single factor, legacy) se
 *     mantiene por BACKWARD-COMPAT pero se reemplaza por 3 campos:
 *       factor_subsidio_e{1,2,3}_cf       (subsidio sobre Cargo Fijo)
 *       factor_subsidio_e{1,2,3}_basico   (subsidio sobre Consumo Basico)
 *       factor_subsidio_e{1,2,3}_excedente (siempre 0 por norma)
 *   - `factor_contribucion_e5` se mantiene (es un factor simple
 *     sobre el subtotal — sigue siendo valido para contribuciones).
 *
 * Spec de la division por bloques:
 *   - Res CRA 825/2017 + L142/1994 art. 99.6: el subsidio se aplica
 *     por bloques (CF, basico, excedente), NO sobre el subtotal.
 *   - Res CRA 750/2016 art. 3: el consumo basico tiene limites
 *     segun altitud (11/13/16 m3/mes).
 *   - Res CRA 825/2017 art. 14: el excedente NO se subsidia.
 */

import type { AcuerdoMunicipal } from '../types';

const ACUERDO_BASE: AcuerdoMunicipal = {
  id_acuerdo: 1,
  id_prestador: 0,
  // Legacy single-factor (backward-compat)
  factor_subsidio_e1: -0.60,
  factor_subsidio_e2: -0.50,
  factor_subsidio_e3: -0.40,
  // 3 porcentajes separados (nuevo)
  factor_subsidio_e1_cf: -0.60,
  factor_subsidio_e1_basico: -0.60,
  factor_subsidio_e1_excedente: 0,
  factor_subsidio_e2_cf: -0.50,
  factor_subsidio_e2_basico: -0.50,
  factor_subsidio_e2_excedente: 0,
  factor_subsidio_e3_cf: -0.40,
  factor_subsidio_e3_basico: -0.40,
  factor_subsidio_e3_excedente: 0,
  // Contribuciones (single-factor sigue valido)
  factor_contribucion_e5: 0.50,
  factor_contribucion_e6: 0.60,
  factor_contribucion_comercial: 0.50,
  factor_contribucion_industrial: 0.30,
  fecha_vigencia_desde: '2026-01-01',
  fecha_vigencia_hasta: '2026-12-31',
  acto_administrativo_url: null,
  observaciones: null,
  created_at: '2026-01-01T00:00:00',
};

describe('AcuerdoMunicipal — 3 porcentajes separados (Res CRA 825/2017 compliance)', () => {
  it('tiene campos _cf, _basico, _excedente para E1', () => {
    expect(typeof ACUERDO_BASE.factor_subsidio_e1_cf).toBe('number');
    expect(typeof ACUERDO_BASE.factor_subsidio_e1_basico).toBe('number');
    expect(typeof ACUERDO_BASE.factor_subsidio_e1_excedente).toBe('number');
  });

  it('tiene campos _cf, _basico, _excedente para E2', () => {
    expect(typeof ACUERDO_BASE.factor_subsidio_e2_cf).toBe('number');
    expect(typeof ACUERDO_BASE.factor_subsidio_e2_basico).toBe('number');
    expect(typeof ACUERDO_BASE.factor_subsidio_e2_excedente).toBe('number');
  });

  it('tiene campos _cf, _basico, _excedente para E3', () => {
    expect(typeof ACUERDO_BASE.factor_subsidio_e3_cf).toBe('number');
    expect(typeof ACUERDO_BASE.factor_subsidio_e3_basico).toBe('number');
    expect(typeof ACUERDO_BASE.factor_subsidio_e3_excedente).toBe('number');
  });

  it('factor excedente es 0 por norma (Res CRA 825/2017 art. 14)', () => {
    expect(ACUERDO_BASE.factor_subsidio_e1_excedente).toBe(0);
    expect(ACUERDO_BASE.factor_subsidio_e2_excedente).toBe(0);
    expect(ACUERDO_BASE.factor_subsidio_e3_excedente).toBe(0);
  });

  it('factores _cf y _basico son negativos (subsidios)', () => {
    expect(ACUERDO_BASE.factor_subsidio_e1_cf).toBeLessThan(0);
    expect(ACUERDO_BASE.factor_subsidio_e1_basico).toBeLessThan(0);
    expect(ACUERDO_BASE.factor_subsidio_e2_cf).toBeLessThan(0);
    expect(ACUERDO_BASE.factor_subsidio_e2_basico).toBeLessThan(0);
    expect(ACUERDO_BASE.factor_subsidio_e3_cf).toBeLessThan(0);
    expect(ACUERDO_BASE.factor_subsidio_e3_basico).toBeLessThan(0);
  });

  it('mantiene campos legacy factor_subsidio_e1/e2/e3 (backward-compat)', () => {
    expect(ACUERDO_BASE.factor_subsidio_e1).toBe(-0.60);
    expect(ACUERDO_BASE.factor_subsidio_e2).toBe(-0.50);
    expect(ACUERDO_BASE.factor_subsidio_e3).toBe(-0.40);
  });
});