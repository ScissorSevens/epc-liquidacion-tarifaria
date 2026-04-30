/**
 * Tests del módulo SUSCRIPTORES — aggregate raíz del modelo de clientes.
 */

import { crearSuscriptor } from '../suscriptores';
import type { CrearSuscriptorInput, SuscriptorBorrador } from '../types';
import { MENSAJES_ERROR_SUSCRIPTOR } from '../types';

const inputValido: CrearSuscriptorInput = {
  codigo: '0005',
  nombre_apellidos: 'Juan Pérez',
  direccion: 'Calle 5 #10-20',
  estrato: 3,
};

describe('crearSuscriptor — factory de borrador', () => {
  it('crea un suscriptor borrador con campos mínimos válidos y estado activo por default', () => {
    const resultado: SuscriptorBorrador = crearSuscriptor(inputValido);

    expect(resultado).toEqual({
      codigo: '0005',
      nombre_apellidos: 'Juan Pérez',
      direccion: 'Calle 5 #10-20',
      estrato: 3,
      estado: 'activo',
    });
    expect(resultado).not.toHaveProperty('id_suscriptor');
    expect(resultado).not.toHaveProperty('created_at');
  });
});

describe('crearSuscriptor — codigo', () => {
  it('rechaza codigo vacío', () => {
    expect(() => crearSuscriptor({ ...inputValido, codigo: '' })).toThrow(
      MENSAJES_ERROR_SUSCRIPTOR.CODIGO_INVALIDO,
    );
  });

  it('rechaza codigo con letras', () => {
    expect(() => crearSuscriptor({ ...inputValido, codigo: 'ABC123' })).toThrow(
      MENSAJES_ERROR_SUSCRIPTOR.CODIGO_INVALIDO,
    );
  });

  it('rechaza codigo de 11 dígitos', () => {
    expect(() => crearSuscriptor({ ...inputValido, codigo: '12345678901' })).toThrow(
      MENSAJES_ERROR_SUSCRIPTOR.CODIGO_INVALIDO,
    );
  });
});

describe('crearSuscriptor — nombre_apellidos y direccion', () => {
  it('rechaza nombre_apellidos vacío', () => {
    expect(() => crearSuscriptor({ ...inputValido, nombre_apellidos: '' })).toThrow(
      MENSAJES_ERROR_SUSCRIPTOR.NOMBRE_VACIO,
    );
  });

  it('rechaza nombre_apellidos de 151 caracteres', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, nombre_apellidos: 'a'.repeat(151) }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.NOMBRE_LARGO);
  });

  it('rechaza direccion vacía', () => {
    expect(() => crearSuscriptor({ ...inputValido, direccion: '' })).toThrow(
      MENSAJES_ERROR_SUSCRIPTOR.DIRECCION_VACIA,
    );
  });

  it('rechaza direccion de 201 caracteres', () => {
    expect(() => crearSuscriptor({ ...inputValido, direccion: 'a'.repeat(201) })).toThrow(
      MENSAJES_ERROR_SUSCRIPTOR.DIRECCION_LARGA,
    );
  });
});

describe('crearSuscriptor — estrato, opcionales y estado', () => {
  it('rechaza estrato 0', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, estrato: 0 as unknown as 1 }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.ESTRATO_FUERA_RANGO);
  });

  it('rechaza estrato 7', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, estrato: 7 as unknown as 1 }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.ESTRATO_FUERA_RANGO);
  });

  it('rechaza estrato 3.5 no entero', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, estrato: 3.5 as unknown as 3 }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.ESTRATO_FUERA_RANGO);
  });

  it('acepta estrato límite inferior 1', () => {
    const resultado = crearSuscriptor({ ...inputValido, estrato: 1 });
    expect(resultado.estrato).toBe(1);
  });

  it('acepta estrato límite superior 6', () => {
    const resultado = crearSuscriptor({ ...inputValido, estrato: 6 });
    expect(resultado.estrato).toBe(6);
  });

  it('rechaza matricula_inmobiliaria de 51 caracteres', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, matricula_inmobiliaria: 'a'.repeat(51) }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.MATRICULA_LARGA);
  });

  it('rechaza numero_catastral de 51 caracteres', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, numero_catastral: 'a'.repeat(51) }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.CATASTRAL_LARGA);
  });

  it('rechaza estado "borrado"', () => {
    expect(() =>
      crearSuscriptor({
        ...inputValido,
        estado: 'borrado' as unknown as 'activo',
      }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.ESTADO_INVALIDO);
  });

  it('acepta estado suspendido y lo preserva', () => {
    const resultado = crearSuscriptor({ ...inputValido, estado: 'suspendido' });
    expect(resultado.estado).toBe('suspendido');
  });
});
