/**
 * Tests del módulo PERIODOS — aggregate del período de facturación mensual.
 */

import { crearPeriodo } from '../periodos';
import type { CrearPeriodoInput } from '../types';
import { MENSAJES_ERROR_PERIODO, PERIODO_REGEX } from '../types';

const inputValido: CrearPeriodoInput = {
  id_periodo: '202503',
  nombre: 'Marzo 2025',
  fecha_inicio: '2025-03-01',
  fecha_fin: '2025-03-31',
  fecha_pago_sin_recargo: '2025-04-15',
  fecha_pago_con_recargo: '2025-04-25',
};

describe('PERIODO_REGEX', () => {
  it('acepta 202503', () => {
    expect(PERIODO_REGEX.test('202503')).toBe(true);
  });

  it('rechaza 2025-3 con guión', () => {
    expect(PERIODO_REGEX.test('2025-3')).toBe(false);
  });

  it('rechaza mes 00', () => {
    expect(PERIODO_REGEX.test('202500')).toBe(false);
  });

  it('rechaza mes 13', () => {
    expect(PERIODO_REGEX.test('202513')).toBe(false);
  });
});

describe('crearPeriodo — factory y validacion de id_periodo', () => {
  it('crea periodo válido con estado abierto por default', () => {
    const resultado = crearPeriodo(inputValido);
    expect(resultado.estado).toBe('abierto');
    expect(resultado.id_periodo).toBe('202503');
  });

  it('rechaza id_periodo con guión', () => {
    expect(() => crearPeriodo({ ...inputValido, id_periodo: '2025-03' })).toThrow(
      MENSAJES_ERROR_PERIODO.ID_PERIODO_INVALIDO,
    );
  });

  it('rechaza año 1999', () => {
    expect(() => crearPeriodo({ ...inputValido, id_periodo: '199912' })).toThrow(
      MENSAJES_ERROR_PERIODO.ID_PERIODO_INVALIDO,
    );
  });

  it('rechaza mes 00', () => {
    expect(() => crearPeriodo({ ...inputValido, id_periodo: '202500' })).toThrow(
      MENSAJES_ERROR_PERIODO.ID_PERIODO_INVALIDO,
    );
  });

  it('rechaza mes 13', () => {
    expect(() => crearPeriodo({ ...inputValido, id_periodo: '202513' })).toThrow(
      MENSAJES_ERROR_PERIODO.ID_PERIODO_INVALIDO,
    );
  });

  it('acepta límite inferior 200001', () => {
    const resultado = crearPeriodo({
      ...inputValido,
      id_periodo: '200001',
      fecha_inicio: '2000-01-01',
      fecha_fin: '2000-01-31',
      fecha_pago_sin_recargo: '2000-02-15',
      fecha_pago_con_recargo: '2000-02-25',
    });
    expect(resultado.id_periodo).toBe('200001');
  });

  it('acepta límite superior 209912', () => {
    const resultado = crearPeriodo({
      ...inputValido,
      id_periodo: '209912',
      fecha_inicio: '2099-12-01',
      fecha_fin: '2099-12-31',
      fecha_pago_sin_recargo: '2100-01-15',
      fecha_pago_con_recargo: '2100-01-25',
    });
    expect(resultado.id_periodo).toBe('209912');
  });
});

describe('crearPeriodo — coherencia de fechas', () => {
  it('rechaza fecha_inicio con formato no ISO', () => {
    expect(() => crearPeriodo({ ...inputValido, fecha_inicio: '01/03/2025' })).toThrow(
      MENSAJES_ERROR_PERIODO.FECHA_INICIO_FORMATO,
    );
  });

  it('rechaza fecha_fin igual a fecha_inicio', () => {
    expect(() =>
      crearPeriodo({
        ...inputValido,
        fecha_inicio: '2025-03-01',
        fecha_fin: '2025-03-01',
      }),
    ).toThrow(MENSAJES_ERROR_PERIODO.FECHA_FIN_ORDEN);
  });

  it('rechaza fecha_fin anterior a fecha_inicio', () => {
    expect(() =>
      crearPeriodo({
        ...inputValido,
        fecha_inicio: '2025-03-31',
        fecha_fin: '2025-03-01',
      }),
    ).toThrow(MENSAJES_ERROR_PERIODO.FECHA_FIN_ORDEN);
  });

  it('rechaza fecha_pago_sin_recargo anterior a fecha_fin', () => {
    expect(() =>
      crearPeriodo({
        ...inputValido,
        fecha_fin: '2025-03-31',
        fecha_pago_sin_recargo: '2025-03-30',
      }),
    ).toThrow(MENSAJES_ERROR_PERIODO.PAGO_SIN_RECARGO_ORDEN);
  });

  it('acepta fecha_pago_sin_recargo igual a fecha_fin', () => {
    const resultado = crearPeriodo({
      ...inputValido,
      fecha_fin: '2025-03-31',
      fecha_pago_sin_recargo: '2025-03-31',
      fecha_pago_con_recargo: '2025-04-25',
    });
    expect(resultado.fecha_pago_sin_recargo).toBe('2025-03-31');
  });

  it('rechaza fecha_pago_con_recargo igual a fecha_pago_sin_recargo', () => {
    expect(() =>
      crearPeriodo({
        ...inputValido,
        fecha_pago_sin_recargo: '2025-04-15',
        fecha_pago_con_recargo: '2025-04-15',
      }),
    ).toThrow(MENSAJES_ERROR_PERIODO.PAGO_CON_RECARGO_ORDEN);
  });
});

describe('crearPeriodo — nombre, dias_consumo y estado', () => {
  it('rechaza nombre vacío', () => {
    expect(() => crearPeriodo({ ...inputValido, nombre: '' })).toThrow(
      MENSAJES_ERROR_PERIODO.NOMBRE_VACIO,
    );
  });

  it('rechaza nombre de 21 caracteres', () => {
    expect(() => crearPeriodo({ ...inputValido, nombre: 'a'.repeat(21) })).toThrow(
      MENSAJES_ERROR_PERIODO.NOMBRE_LARGO,
    );
  });

  it('rechaza dias_consumo cero', () => {
    expect(() => crearPeriodo({ ...inputValido, dias_consumo: 0 })).toThrow(
      MENSAJES_ERROR_PERIODO.DIAS_CONSUMO_INVALIDO,
    );
  });

  it('rechaza dias_consumo no entero (30.5)', () => {
    expect(() => crearPeriodo({ ...inputValido, dias_consumo: 30.5 })).toThrow(
      MENSAJES_ERROR_PERIODO.DIAS_CONSUMO_INVALIDO,
    );
  });

  it('acepta dias_consumo undefined', () => {
    const resultado = crearPeriodo(inputValido);
    expect(resultado.dias_consumo).toBeUndefined();
  });

  it('rechaza estado "anulado"', () => {
    expect(() =>
      crearPeriodo({
        ...inputValido,
        estado: 'anulado' as unknown as 'abierto',
      }),
    ).toThrow(MENSAJES_ERROR_PERIODO.ESTADO_INVALIDO);
  });

  it('acepta estado facturado y lo preserva', () => {
    const resultado = crearPeriodo({ ...inputValido, estado: 'facturado' });
    expect(resultado.estado).toBe('facturado');
  });
});
