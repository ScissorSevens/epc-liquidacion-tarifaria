/**
 * Módulo SINCRONIZACION — Cola offline de items para enviar al backend
 */

import { agregarItemACola } from '../cola';

describe('agregarItemACola', () => {
  it('debería crear un item con estado PENDIENTE', () => {
    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'abc123',
    });

    expect(item.estado).toBe('PENDIENTE');
  });

  it('debería asignar un id único a cada item', () => {
    const i1 = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'abc123',
    });
    const i2 = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-002', total: 18000 },
      hashLocal: 'def456',
    });

    expect(i1.id).not.toBe(i2.id);
  });

  it('debería inicializar intentos en 0', () => {
    const item = agregarItemACola({
      tipo: 'LECTURA',
      payload: { suscriptorId: 'SUSC-001', valor: 1234 },
      hashLocal: 'xyz',
    });

    expect(item.intentos).toBe(0);
  });

  it('debería tener ultimoError = null al crearse', () => {
    const item = agregarItemACola({
      tipo: 'EVIDENCIA',
      payload: { hashFoto: 'hhh' },
      hashLocal: 'qqq',
    });

    expect(item.ultimoError).toBeNull();
  });

  it('debería capturar timestamp de creación', () => {
    const antes = Date.now();
    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'abc',
    });
    const despues = Date.now();

    expect(item.creadoEn.getTime()).toBeGreaterThanOrEqual(antes);
    expect(item.creadoEn.getTime()).toBeLessThanOrEqual(despues);
  });
});
