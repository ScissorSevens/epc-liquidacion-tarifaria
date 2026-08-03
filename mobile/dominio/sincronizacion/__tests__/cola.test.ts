/**
 * Módulo SINCRONIZACION — Cola offline de items para enviar al backend
 */

import { agregarItemACola } from '../cola';
import type { IdGenerator } from '../../shared/ports';

function crearIdGenFake(prefijo = 'uuid-fake'): IdGenerator {
  let n = 0;
  return { uuid: () => `${prefijo}-${String(++n).padStart(3, '0')}` };
}

describe('agregarItemACola', () => {
  it('debería crear un item con estado PENDIENTE', () => {
    const item = agregarItemACola(
      {
        tipo: 'LIQUIDACION',
        payload: { id: 'LIQ-001', total: 17000 },
        hashLocal: 'abc123',
      },
      crearIdGenFake(),
    );

    expect(item.estado).toBe('PENDIENTE');
  });

  it('usa el IdGenerator inyectado para asignar el id (no crypto built-in)', () => {
    const fakeId: IdGenerator = { uuid: () => 'fake-uuid-001' };
    const item = agregarItemACola(
      { tipo: 'LIQUIDACION', payload: {}, hashLocal: 'h' },
      fakeId,
    );
    expect(item.id).toBe('fake-uuid-001');
  });

  it('debería asignar un id único a cada item', () => {
    const idGen = crearIdGenFake();
    const i1 = agregarItemACola(
      { tipo: 'LIQUIDACION', payload: { id: 'LIQ-001', total: 17000 }, hashLocal: 'abc123' },
      idGen,
    );
    const i2 = agregarItemACola(
      { tipo: 'LIQUIDACION', payload: { id: 'LIQ-002', total: 18000 }, hashLocal: 'def456' },
      idGen,
    );

    expect(i1.id).not.toBe(i2.id);
  });

  it('debería inicializar intentos en 0', () => {
    const item = agregarItemACola(
      { tipo: 'LECTURA', payload: { suscriptorId: 'SUSC-001', valor: 1234 }, hashLocal: 'xyz' },
      crearIdGenFake(),
    );

    expect(item.intentos).toBe(0);
  });

  it('debería tener ultimoError = null al crearse', () => {
    const item = agregarItemACola(
      { tipo: 'EVIDENCIA', payload: { hashFoto: 'hhh' }, hashLocal: 'qqq' },
      crearIdGenFake(),
    );

    expect(item.ultimoError).toBeNull();
  });

  it('debería capturar timestamp de creación', () => {
    const antes = Date.now();
    const item = agregarItemACola(
      { tipo: 'LIQUIDACION', payload: { id: 'LIQ-001', total: 17000 }, hashLocal: 'abc' },
      crearIdGenFake(),
    );
    const despues = Date.now();

    expect(item.creadoEn.getTime()).toBeGreaterThanOrEqual(antes);
    expect(item.creadoEn.getTime()).toBeLessThanOrEqual(despues);
  });
});
