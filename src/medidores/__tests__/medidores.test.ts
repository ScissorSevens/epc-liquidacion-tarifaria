/**
 * Tests del módulo MEDIDORES — aggregate del dispositivo físico de medición.
 */

import { crearMedidor } from '../medidores';
import type { CrearMedidorInput, MedidorBorrador } from '../types';
import { MENSAJES_ERROR_MEDIDOR } from '../types';

const inputValido: CrearMedidorInput = {
  numero_medidor: 'MED-001',
  id_suscriptor: 1,
  fecha_instalacion: '2025-03-15',
};

describe('crearMedidor — factory de borrador', () => {
  it('crea un medidor borrador con campos minimos y estado activo por default', () => {
    const resultado: MedidorBorrador = crearMedidor(inputValido);

    expect(resultado).toEqual({
      numero_medidor: 'MED-001',
      id_suscriptor: 1,
      fecha_instalacion: '2025-03-15',
      estado: 'activo',
    });
    expect(resultado).not.toHaveProperty('id_medidor');
    expect(resultado).not.toHaveProperty('created_at');
  });
});

describe('crearMedidor — numero_medidor', () => {
  it('rechaza numero_medidor con espacios', () => {
    expect(() =>
      crearMedidor({ ...inputValido, numero_medidor: 'MED 001' }),
    ).toThrow(MENSAJES_ERROR_MEDIDOR.NUMERO_INVALIDO);
  });

  it('rechaza numero_medidor vacío', () => {
    expect(() =>
      crearMedidor({ ...inputValido, numero_medidor: '' }),
    ).toThrow(MENSAJES_ERROR_MEDIDOR.NUMERO_INVALIDO);
  });

  it('rechaza numero_medidor de 51 caracteres', () => {
    expect(() =>
      crearMedidor({ ...inputValido, numero_medidor: 'A'.repeat(51) }),
    ).toThrow(MENSAJES_ERROR_MEDIDOR.NUMERO_INVALIDO);
  });
});
