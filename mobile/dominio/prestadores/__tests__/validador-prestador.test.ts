/**
 * Tests del validador de PRESTADORES — reglas puras del multi-tenant.
 *
 * Cubre los requisitos del SDD `setup-inicial-multi-tenant-auth`:
 *   - Fase 2, Tarea 2.1 — `cedulaRepresentanteLegalValida`
 *
 * Foco: contrato `boolean` de la función (no errores). El dominio retorna
 * `true`/`false` y la capa de UI (Fase 5) se encarga de mapear a mensajes.
 */

import { cedulaRepresentanteLegalValida } from '../validador-prestador';

describe('cedulaRepresentanteLegalValida — happy path', () => {
  it('acepta cédula de 6 dígitos (límite inferior)', () => {
    expect(cedulaRepresentanteLegalValida('123456')).toBe(true);
  });

  it('acepta cédula de 10 dígitos (caso típico colombiano)', () => {
    expect(cedulaRepresentanteLegalValida('1234567890')).toBe(true);
  });

  it('acepta cédula de 12 dígitos (límite superior)', () => {
    expect(cedulaRepresentanteLegalValida('123456789012')).toBe(true);
  });
});

describe('cedulaRepresentanteLegalValida — longitud', () => {
  it('rechaza cédula vacía', () => {
    expect(cedulaRepresentanteLegalValida('')).toBe(false);
  });

  it('rechaza cédula de 5 dígitos (un dígito menos del mínimo)', () => {
    expect(cedulaRepresentanteLegalValida('12345')).toBe(false);
  });

  it('rechaza cédula de 13 dígitos (un dígito más del máximo)', () => {
    expect(cedulaRepresentanteLegalValida('1234567890123')).toBe(false);
  });
});

describe('cedulaRepresentanteLegalValida — formato', () => {
  it('rechaza cédula con letras', () => {
    expect(cedulaRepresentanteLegalValida('abc12345')).toBe(false);
  });

  it('rechaza cédula con separadores numéricos (puntos)', () => {
    expect(cedulaRepresentanteLegalValida('12.345.678')).toBe(false);
  });

  it('rechaza cédula con guion', () => {
    expect(cedulaRepresentanteLegalValida('123-456')).toBe(false);
  });

  it('rechaza cédula con espacios', () => {
    expect(cedulaRepresentanteLegalValida('123 456')).toBe(false);
  });
});
