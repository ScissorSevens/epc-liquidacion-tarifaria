/**
 * Tests del validador de OPERARIOS — reglas puras del multi-tenant.
 *
 * Cubre los requisitos del SDD `setup-inicial-multi-tenant-auth`:
 *   - Fase 2, Tarea 2.2 — `idPrestadorRequeridoValido`
 *   - Fase 2, Tarea 2.3 — `passwordCumpleMinima` (este commit)
 *
 * Foco: contrato `boolean` de las funciones (no errores). El dominio
 * retorna `true`/`false` y la capa de UI (Fase 5) se encarga de mapear
 * a mensajes al usuario.
 */

import {
  idPrestadorRequeridoValido,
  passwordCumpleMinima,
} from '../validador-operario';

describe('idPrestadorRequeridoValido — happy path', () => {
  it('acepta id_prestador = 1 (mínimo positivo)', () => {
    expect(idPrestadorRequeridoValido(1)).toBe(true);
  });

  it('acepta id_prestador = 5', () => {
    expect(idPrestadorRequeridoValido(5)).toBe(true);
  });

  it('acepta id_prestador = 100', () => {
    expect(idPrestadorRequeridoValido(100)).toBe(true);
  });
});

describe('idPrestadorRequeridoValido — rechaza cero y negativos', () => {
  it('rechaza id_prestador = 0 (legacy sin prestador)', () => {
    expect(idPrestadorRequeridoValido(0)).toBe(false);
  });

  it('rechaza id_prestador negativo', () => {
    expect(idPrestadorRequeridoValido(-1)).toBe(false);
  });

  it('rechaza id_prestador negativo grande', () => {
    expect(idPrestadorRequeridoValido(-999)).toBe(false);
  });
});

describe('idPrestadorRequeridoValido — rechaza no enteros', () => {
  it('rechaza id_prestador = 1.5 (decimal)', () => {
    expect(idPrestadorRequeridoValido(1.5)).toBe(false);
  });

  it('rechaza id_prestador = 0.1', () => {
    expect(idPrestadorRequeridoValido(0.1)).toBe(false);
  });

  it('rechaza id_prestador = NaN', () => {
    expect(idPrestadorRequeridoValido(Number.NaN)).toBe(false);
  });
});

describe('passwordCumpleMinima — happy path', () => {
  it('acepta password de exactamente 8 caracteres (límite inferior)', () => {
    expect(passwordCumpleMinima('abcdefgh')).toBe(true);
  });

  it('acepta password de 12 caracteres con mezcla de clases', () => {
    expect(passwordCumpleMinima('MiPass2024!!')).toBe(true);
  });

  it('acepta password de 100 caracteres', () => {
    const passwordLarga = 'a'.repeat(100);
    expect(passwordCumpleMinima(passwordLarga)).toBe(true);
  });
});

describe('passwordCumpleMinima — longitud insuficiente', () => {
  it('rechaza password vacía', () => {
    expect(passwordCumpleMinima('')).toBe(false);
  });

  it('rechaza password de 6 caracteres', () => {
    expect(passwordCumpleMinima('abc123')).toBe(false);
  });

  it('rechaza password de 7 caracteres (un carácter menos del mínimo)', () => {
    expect(passwordCumpleMinima('abcdefg')).toBe(false);
  });
});
