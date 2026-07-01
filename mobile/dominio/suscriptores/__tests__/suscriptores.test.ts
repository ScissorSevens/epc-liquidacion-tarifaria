/**
 * Tests del módulo SUSCRIPTORES — aggregate raíz del modelo de clientes.
 */

import { crearSuscriptor } from '../suscriptores';
import type { CrearSuscriptorInput, SuscriptorBorrador } from '../types';
import { MENSAJES_ERROR_SUSCRIPTOR } from '../types';

const inputValido: CrearSuscriptorInput = {
  codigo: '0005',
  nombre_apellidos: 'Juan Pérez',
  cedula: '1234567',
  municipio: 'Bogotá',
  direccion: 'Calle 5 #10-20',
  estrato: 3,
  aplica_subsidio: false,
  id_prestador: 0,
  categoria_uso: 'residencial',
};

describe('crearSuscriptor — factory de borrador', () => {
  it('crea un suscriptor borrador con campos mínimos válidos y estado activo por default', () => {
    const resultado: SuscriptorBorrador = crearSuscriptor(inputValido);

    expect(resultado).toEqual({
      codigo: '0005',
      nombre_apellidos: 'Juan Pérez',
      cedula: '1234567',
      municipio: 'Bogotá',
      direccion: 'Calle 5 #10-20',
      estrato: 3,
      matricula_inmobiliaria: undefined,
      numero_catastral: undefined,
      aplica_subsidio: false,
      estado: 'activo',
      id_prestador: 0,
      categoria_uso: 'residencial',
    });
    expect(resultado).not.toHaveProperty('id_suscriptor');
    expect(resultado).not.toHaveProperty('created_at');
  });

  it('propaga id_prestador y categoria_uso cuando el caller los provee', () => {
    const resultado = crearSuscriptor({
      ...inputValido,
      id_prestador: 7,
      categoria_uso: 'comercial',
    });
    expect(resultado.id_prestador).toBe(7);
    expect(resultado.categoria_uso).toBe('comercial');
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

describe('crearSuscriptor — cedula', () => {
  it('rechaza cedula vacía', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, cedula: '' } as unknown as CrearSuscriptorInput),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.CEDULA_VACIA);
  });

  it('rechaza cedula con letras', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, cedula: 'ABC123' } as unknown as CrearSuscriptorInput),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.CEDULA_INVALIDA);
  });

  it('rechaza cedula de 5 dígitos', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, cedula: '12345' } as unknown as CrearSuscriptorInput),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.CEDULA_INVALIDA);
  });

  it('rechaza cedula de 13 dígitos', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, cedula: '1234567890123' } as unknown as CrearSuscriptorInput),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.CEDULA_INVALIDA);
  });

  it('acepta cedula de 6 dígitos (límite inferior)', () => {
    const resultado = crearSuscriptor({ ...inputValido, cedula: '123456' });
    expect(resultado.cedula).toBe('123456');
  });

  it('acepta cedula de 12 dígitos (límite superior)', () => {
    const resultado = crearSuscriptor({ ...inputValido, cedula: '123456789012' });
    expect(resultado.cedula).toBe('123456789012');
  });
});

describe('crearSuscriptor — municipio', () => {
  it('rechaza municipio vacío', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, municipio: '' }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.MUNICIPIO_VACIO);
  });

  it('rechaza municipio de 101 caracteres', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, municipio: 'a'.repeat(101) }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.MUNICIPIO_LARGO);
  });

  it('acepta municipio válido', () => {
    const resultado = crearSuscriptor({ ...inputValido, municipio: 'Medellín' });
    expect(resultado.municipio).toBe('Medellín');
  });
});

describe('crearSuscriptor — sector', () => {
  it('rechaza sector de 101 caracteres', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, sector: 'a'.repeat(101) }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.SECTOR_LARGO);
  });

  it('acepta sector undefined', () => {
    const resultado = crearSuscriptor({ ...inputValido, sector: undefined });
    expect(resultado.sector).toBeUndefined();
  });
});

describe('crearSuscriptor — calle', () => {
  it('rechaza calle de 101 caracteres', () => {
    expect(() =>
      crearSuscriptor({ ...inputValido, calle: 'a'.repeat(101) }),
    ).toThrow(MENSAJES_ERROR_SUSCRIPTOR.CALLE_LARGA);
  });

  it('acepta calle undefined', () => {
    const resultado = crearSuscriptor({ ...inputValido, calle: undefined });
    expect(resultado.calle).toBeUndefined();
  });
});
