/**
 * Tests del módulo OPERARIOS — aggregate del personal del sistema.
 */

import { crearOperario } from '../operarios';
import type { CrearOperarioInput, OperarioBorrador } from '../types';
import { MENSAJES_ERROR_OPERARIO } from '../types';

const inputValido: CrearOperarioInput = {
  numero_cedula: '1234567890',
  nombre: 'Ana Gómez',
  email: 'ana@epc.co',
  password_hash: 'argon2id$v=19$m=...',
};

describe('crearOperario — factory de borrador', () => {
  it('crea operario borrador con defaults rol=operario y estado=activo', () => {
    const resultado: OperarioBorrador = crearOperario(inputValido);

    expect(resultado).toEqual({
      numero_cedula: '1234567890',
      nombre: 'Ana Gómez',
      email: 'ana@epc.co',
      password_hash: 'argon2id$v=19$m=...',
      rol: 'operario',
      estado: 'activo',
    });
    expect(resultado).not.toHaveProperty('id_operario');
    expect(resultado).not.toHaveProperty('created_at');
  });
});

describe('crearOperario — numero_cedula', () => {
  it('rechaza numero_cedula con letras', () => {
    expect(() =>
      crearOperario({ ...inputValido, numero_cedula: 'ABC12345' }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.CEDULA_INVALIDA);
  });

  it('rechaza numero_cedula de 5 digitos', () => {
    expect(() =>
      crearOperario({ ...inputValido, numero_cedula: '12345' }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.CEDULA_INVALIDA);
  });

  it('rechaza numero_cedula de 13 digitos', () => {
    expect(() =>
      crearOperario({ ...inputValido, numero_cedula: '1234567890123' }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.CEDULA_INVALIDA);
  });

  it('acepta numero_cedula límite inferior 100000', () => {
    const resultado = crearOperario({ ...inputValido, numero_cedula: '100000' });
    expect(resultado.numero_cedula).toBe('100000');
  });
});

describe('crearOperario — email', () => {
  it('rechaza email sin arroba', () => {
    expect(() =>
      crearOperario({ ...inputValido, email: 'carlos.epc.co' }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.EMAIL_INVALIDO);
  });

  it('rechaza email sin dominio', () => {
    expect(() =>
      crearOperario({ ...inputValido, email: 'carlos@' }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.EMAIL_INVALIDO);
  });

  it('rechaza email con espacios', () => {
    expect(() =>
      crearOperario({ ...inputValido, email: 'car los@epc.co' }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.EMAIL_INVALIDO);
  });
});

describe('crearOperario — password_hash y rol', () => {
  it('rechaza password_hash vacío', () => {
    expect(() =>
      crearOperario({ ...inputValido, password_hash: '' }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.PASSWORD_HASH_VACIO);
  });

  it('almacena password_hash verbatim sin transformaciones', () => {
    const resultado = crearOperario({
      ...inputValido,
      password_hash: '$2b$10$XYZ.exact.value',
    });
    expect(resultado.password_hash).toBe('$2b$10$XYZ.exact.value');
  });

  it('rechaza rol "root"', () => {
    expect(() =>
      crearOperario({
        ...inputValido,
        rol: 'root' as unknown as 'operario',
      }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.ROL_INVALIDO);
  });

  it('acepta rol admin y lo preserva', () => {
    const resultado = crearOperario({ ...inputValido, rol: 'admin' });
    expect(resultado.rol).toBe('admin');
  });
});
