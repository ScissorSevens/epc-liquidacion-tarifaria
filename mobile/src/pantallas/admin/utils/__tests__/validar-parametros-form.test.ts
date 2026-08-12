/**
 * Tests unitarios del modulo puro `validar-parametros-form`.
 *
 * Cleanup F3 del verify-report de `parametros-tarifa-screen-decomposition`.
 * Replica cada regla documentada en el módulo para garantizar
 * cobertura 1:1 con el codigo inline original.
 */

import {
  esUrlValida,
  validarParametrosForm,
  type ParametrosFormValidationInput,
} from '../validar-parametros-form';

const inputValido: ParametrosFormValidationInput = {
  cma: '12000000', // > CMA_MINIMO_ACUEDUCTO (2890)
  cmo: '500', // > CMOG_MINIMO_ACUEDUCTO (467)
  suscriptoresPromedio: '1000',
  vigenteDesde: '2026-01-01',
  vigenteHasta: '2030-12-31',
  actoAdopcion: '',
  documentoSoporteUrl: '',
  anioBase: '2016',
  anioDestino: '2026',
  factorIpc: '1.0',
  ipufIndice: '1.0',
};

describe('validar-parametros-form helpers', () => {
  describe('esUrlValida', () => {
    it.each(['', 'http://example.com', 'https://example.com/path?query=1'])(
      'esUrlValida(%j) === true (valido o vacio)',
      (input) => {
        expect(esUrlValida(input)).toBe(true);
      },
    );

    it.each([
      'not-a-url',
      'ftp://example.com', // protocolo no permitido
      'example.com', // falta esquema
      'http://', // falta host
      'http:// example.com', // espacio
    ])('esUrlValida(%j) === false (invalido)', (input) => {
      expect(esUrlValida(input)).toBe(false);
    });
  });

  describe('validarParametrosForm — happy path', () => {
    it('retorna {} (sin errores) para input valido', () => {
      expect(validarParametrosForm(inputValido)).toEqual({});
    });
  });

  describe('validarParametrosForm — Res CRA 825/2017 Art. 15 (CMA minimo)', () => {
    it('cma = 0 → error (bajo minimo)', () => {
      const errors = validarParametrosForm({ ...inputValido, cma: '0' });
      expect(errors.cma).toMatch(/CMA_BAJO_MINIMO/);
    });
    it('cma = -100 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, cma: '-100' });
      expect(errors.cma).toMatch(/CMA_BAJO_MINIMO/);
    });
    it('cma = 2890 (exacto minimo) → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, cma: '2890' });
      expect(errors.cma).toBeUndefined();
    });
    it('cma = 2891 (sobre minimo) → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, cma: '2891' });
      expect(errors.cma).toBeUndefined();
    });
  });

  describe('validarParametrosForm — Res CRA 825/2017 Art. 18 (CMOG minimo)', () => {
    it('cmo = 0 → error (bajo minimo)', () => {
      const errors = validarParametrosForm({ ...inputValido, cmo: '0' });
      expect(errors.cmo).toMatch(/CMOG_BAJO_MINIMO/);
    });
    it('cmo = 100 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, cmo: '100' });
      expect(errors.cmo).toMatch(/CMOG_BAJO_MINIMO/);
    });
    it('cmo = 467 (exacto minimo) → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, cmo: '467' });
      expect(errors.cmo).toBeUndefined();
    });
  });

  describe('validarParametrosForm — suscriptores (anti division por cero)', () => {
    it('suscriptores = 0 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, suscriptoresPromedio: '0' });
      expect(errors.suscriptores).toBe('Suscriptores debe ser > 0');
    });
    it('suscriptores = -5 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, suscriptoresPromedio: '-5' });
      expect(errors.suscriptores).toBe('Suscriptores debe ser > 0');
    });
    it('suscriptores = 1 (minimo positivo) → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, suscriptoresPromedio: '1' });
      expect(errors.suscriptores).toBeUndefined();
    });
  });

  describe('validarParametrosForm — fechas de vigencia', () => {
    it('vigenteDesde > vigenteHasta → error en vigenteHasta', () => {
      const errors = validarParametrosForm({
        ...inputValido,
        vigenteDesde: '2030-01-01',
        vigenteHasta: '2026-12-31',
      });
      expect(errors.vigenteHasta).toBe('Vigente hasta debe ser posterior a vigente desde');
    });
    it('vigenteDesde < vigenteHasta → OK', () => {
      const errors = validarParametrosForm({
        ...inputValido,
        vigenteDesde: '2026-01-01',
        vigenteHasta: '2030-12-31',
      });
      expect(errors.vigenteHasta).toBeUndefined();
    });
    it('vigenteDesde o vigenteHasta vacios → no valida (skip)', () => {
      const errorsA = validarParametrosForm({ ...inputValido, vigenteDesde: '' });
      const errorsB = validarParametrosForm({ ...inputValido, vigenteHasta: '' });
      expect(errorsA.vigenteHasta).toBeUndefined();
      expect(errorsB.vigenteHasta).toBeUndefined();
    });
  });

  describe('validarParametrosForm — URLs validas (actos administrativos)', () => {
    it('actoAdopcion invalida → error', () => {
      const errors = validarParametrosForm({ ...inputValido, actoAdopcion: 'not-a-url' });
      expect(errors.actoAdopcion).toBe('Debe ser una URL válida (http:// o https://)');
    });
    it('actoAdopcion valida → OK', () => {
      const errors = validarParametrosForm({
        ...inputValido,
        actoAdopcion: 'https://example.com/decreto-042-2024',
      });
      expect(errors.actoAdopcion).toBeUndefined();
    });
    it('documentoSoporteUrl invalida → error', () => {
      const errors = validarParametrosForm({ ...inputValido, documentoSoporteUrl: 'ftp://x' });
      expect(errors.documentoSoporteUrl).toBe('Debe ser una URL válida (http:// o https://)');
    });
  });

  describe('validarParametrosForm — Res CRA 825/2017 Art. 11 (Indexacion IPC)', () => {
    it('anioBase = 2000 → error (no > 2000)', () => {
      const errors = validarParametrosForm({ ...inputValido, anioBase: '2000' });
      expect(errors.anioBase).toBe('Anio base debe ser > 2000');
    });
    it('anioBase = 2001 → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, anioBase: '2001' });
      expect(errors.anioBase).toBeUndefined();
    });
    it('anioDestino = 0 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, anioDestino: '0' });
      expect(errors.anioDestino).toBe('Anio destino debe ser > 2000');
    });
    it('anioDestino = 2026 → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, anioDestino: '2026' });
      expect(errors.anioDestino).toBeUndefined();
    });
    it('factorIpc = 0 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, factorIpc: '0' });
      expect(errors.factorIpc).toBe('Factor IPC debe ser > 0');
    });
    it('factorIpc = -0.5 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, factorIpc: '-0.5' });
      expect(errors.factorIpc).toBe('Factor IPC debe ser > 0');
    });
    it('factorIpc = 1.05 → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, factorIpc: '1.05' });
      expect(errors.factorIpc).toBeUndefined();
    });
    it('ipufIndice = 0 → error', () => {
      const errors = validarParametrosForm({ ...inputValido, ipufIndice: '0' });
      expect(errors.ipufIndice).toBe('IPUF indice debe ser > 0');
    });
    it('ipufIndice = 1.0 → OK', () => {
      const errors = validarParametrosForm({ ...inputValido, ipufIndice: '1.0' });
      expect(errors.ipufIndice).toBeUndefined();
    });
  });

  describe('validarParametrosForm — combinacion de errores', () => {
    it('multiples errores simultaneos se reportan todos', () => {
      const errors = validarParametrosForm({
        cma: '0', // CMA bajo minimo
        cmo: '0', // CMOG bajo minimo
        suscriptoresPromedio: '0', // anti div-by-0
        vigenteDesde: '2030-01-01',
        vigenteHasta: '2026-01-01', // invertidas
        actoAdopcion: 'invalid', // URL invalida
        documentoSoporteUrl: '',
        anioBase: '1999', // <= 2000
        anioDestino: '0', // <= 2000
        factorIpc: '0', // <= 0
        ipufIndice: '0', // <= 0
      });
      expect(errors.cma).toBeDefined();
      expect(errors.cmo).toBeDefined();
      expect(errors.suscriptores).toBeDefined();
      expect(errors.vigenteHasta).toBeDefined();
      expect(errors.actoAdopcion).toBeDefined();
      expect(errors.anioBase).toBeDefined();
      expect(errors.anioDestino).toBeDefined();
      expect(errors.factorIpc).toBeDefined();
      expect(errors.ipufIndice).toBeDefined();
    });
  });
});
