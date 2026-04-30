/**
 * Tests del módulo PERIODOS — aggregate del período de facturación mensual.
 */

import { PERIODO_REGEX } from '../types';

describe('PERIODO_REGEX', () => {
  it('acepta 202503', () => {
    expect(PERIODO_REGEX.test('202503')).toBe(true);
  });

  it('rechaza 2025-3 con guión', () => {
    expect(PERIODO_REGEX.test('2025-3')).toBe(false);
  });

  it('rechaza mes 00', () => {
    expect(PERIODO_REGEX.test('202500')).toBe(false);
  });

  it('rechaza mes 13', () => {
    expect(PERIODO_REGEX.test('202513')).toBe(false);
  });
});
