/**
 * Tests del módulo OPERARIOS — aggregate del personal del sistema.
 */

import { crearOperario } from '../operarios';
import type { CrearOperarioInput, OperarioBorrador } from '../types';
import { MENSAJES_ERROR_OPERARIO } from '../types';

const inputValido: CrearOperarioInput = {
  id_prestador: 1,
  numero_cedula: '1234567890',
  nombre: 'Ana Gómez',
  email: 'ana@epc.co',
  password_hash: 'argon2id$v=19$m=...',
};

describe('crearOperario — factory de borrador', () => {
  it('crea operario borrador con defaults rol=operario y estado=activo', () => {
    const resultado: OperarioBorrador = crearOperario(inputValido);

    expect(resultado).toEqual({
      id_prestador: 1,
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

  it('propaga id_prestador del input al OperarioBorrador', () => {
    const resultado = crearOperario({ ...inputValido, id_prestador: 7 });
    expect(resultado.id_prestador).toBe(7);
  });
});

describe('crearOperario — id_prestador (Fase 3 cierre / TDD)', () => {
  it('rechaza id_prestador = 0 con ID_PRESTADOR_INVALIDO', () => {
    expect(() => crearOperario({ ...inputValido, id_prestador: 0 })).toThrow(
      MENSAJES_ERROR_OPERARIO.ID_PRESTADOR_INVALIDO,
    );
  });

  it('rechaza id_prestador negativo', () => {
    expect(() => crearOperario({ ...inputValido, id_prestador: -1 })).toThrow(
      MENSAJES_ERROR_OPERARIO.ID_PRESTADOR_INVALIDO,
    );
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

describe('crearOperario — nombre, estado y dispositivo_id', () => {
  it('rechaza nombre vacío', () => {
    expect(() => crearOperario({ ...inputValido, nombre: '' })).toThrow(
      MENSAJES_ERROR_OPERARIO.NOMBRE_VACIO,
    );
  });

  it('rechaza nombre de 151 caracteres', () => {
    expect(() =>
      crearOperario({ ...inputValido, nombre: 'a'.repeat(151) }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.NOMBRE_LARGO);
  });

  it('rechaza estado "suspendido"', () => {
    expect(() =>
      crearOperario({
        ...inputValido,
        estado: 'suspendido' as unknown as 'activo',
      }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.ESTADO_INVALIDO);
  });

  it('acepta estado inactivo y lo preserva', () => {
    const resultado = crearOperario({ ...inputValido, estado: 'inactivo' });
    expect(resultado.estado).toBe('inactivo');
  });

  it('rechaza dispositivo_id de 101 caracteres', () => {
    expect(() =>
      crearOperario({ ...inputValido, dispositivo_id: 'a'.repeat(101) }),
    ).toThrow(MENSAJES_ERROR_OPERARIO.DISPOSITIVO_LARGO);
  });

  it('acepta dispositivo_id undefined', () => {
    const resultado = crearOperario(inputValido);
    expect(resultado.dispositivo_id).toBeUndefined();
  });
});
