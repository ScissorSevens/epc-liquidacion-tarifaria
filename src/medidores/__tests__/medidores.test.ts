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

describe('crearMedidor — id_suscriptor', () => {
  it('rechaza id_suscriptor cero', () => {
    expect(() => crearMedidor({ ...inputValido, id_suscriptor: 0 })).toThrow(
      MENSAJES_ERROR_MEDIDOR.ID_SUSCRIPTOR_INVALIDO,
    );
  });

  it('rechaza id_suscriptor negativo', () => {
    expect(() => crearMedidor({ ...inputValido, id_suscriptor: -5 })).toThrow(
      MENSAJES_ERROR_MEDIDOR.ID_SUSCRIPTOR_INVALIDO,
    );
  });

  it('rechaza id_suscriptor no entero', () => {
    expect(() => crearMedidor({ ...inputValido, id_suscriptor: 1.5 })).toThrow(
      MENSAJES_ERROR_MEDIDOR.ID_SUSCRIPTOR_INVALIDO,
    );
  });
});

describe('crearMedidor — fecha_instalacion', () => {
  it('rechaza fecha_instalacion con formato no ISO', () => {
    expect(() =>
      crearMedidor({ ...inputValido, fecha_instalacion: '15/03/2025' }),
    ).toThrow(MENSAJES_ERROR_MEDIDOR.FECHA_FORMATO);
  });

  it('rechaza fecha_instalacion futura usando deps.now', () => {
    expect(() =>
      crearMedidor(
        { ...inputValido, fecha_instalacion: '2099-12-31' },
        { now: () => new Date('2025-03-15T00:00:00Z') },
      ),
    ).toThrow(MENSAJES_ERROR_MEDIDOR.FECHA_FUTURA);
  });

  it('acepta fecha_instalacion igual a hoy (con deps.now)', () => {
    const resultado = crearMedidor(
      { ...inputValido, fecha_instalacion: '2025-03-15' },
      { now: () => new Date('2025-03-15T12:00:00Z') },
    );
    expect(resultado.fecha_instalacion).toBe('2025-03-15');
  });

  it('acepta fecha_instalacion pasada (con deps.now)', () => {
    const resultado = crearMedidor(
      { ...inputValido, fecha_instalacion: '2024-01-01' },
      { now: () => new Date('2025-03-15T00:00:00Z') },
    );
    expect(resultado.fecha_instalacion).toBe('2024-01-01');
  });
});
