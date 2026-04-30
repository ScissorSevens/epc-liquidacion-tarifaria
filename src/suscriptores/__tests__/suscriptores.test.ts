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
