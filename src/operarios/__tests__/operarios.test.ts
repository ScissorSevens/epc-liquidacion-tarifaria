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
