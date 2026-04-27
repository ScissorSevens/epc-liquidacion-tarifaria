/**
 * Repository de la cola de sincronización
 */

import { agregarItemACola } from '../cola';
import { InMemoryColaSincronizacion } from '../cola-repository';

describe('InMemoryColaSincronizacion', () => {
  it('debería estar vacía al crearse', async () => {
    const cola = new InMemoryColaSincronizacion();
    const items = await cola.listar();
    expect(items).toEqual([]);
  });

  it('debería guardar y recuperar un item', async () => {
    const cola = new InMemoryColaSincronizacion();
    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001' },
      hashLocal: 'abc',
    });

    await cola.guardar(item);
    const items = await cola.listar();

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
  });

  it('debería listar solo items en estado PENDIENTE con listarPendientes()', async () => {
    const cola = new InMemoryColaSincronizacion();
    const pendiente = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001' },
      hashLocal: 'a',
    });
    const exitoso = { ...agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-002' },
      hashLocal: 'b',
    }), estado: 'EXITOSO' as const };

    await cola.guardar(pendiente);
    await cola.guardar(exitoso);

    const pendientes = await cola.listarPendientes();
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].id).toBe(pendiente.id);
  });

  it('debería actualizar un item existente por id (no duplicar)', async () => {
    const cola = new InMemoryColaSincronizacion();
    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001' },
      hashLocal: 'a',
    });

    await cola.guardar(item);
    await cola.guardar({ ...item, estado: 'EXITOSO' });

    const items = await cola.listar();
    expect(items).toHaveLength(1);
    expect(items[0].estado).toBe('EXITOSO');
  });

  it('debería buscar item por id con buscarPorId()', async () => {
    const cola = new InMemoryColaSincronizacion();
    const item = agregarItemACola({
      tipo: 'LECTURA',
      payload: { v: 1 },
      hashLocal: 'a',
    });

    await cola.guardar(item);
    const encontrado = await cola.buscarPorId(item.id);

    expect(encontrado?.id).toBe(item.id);
  });

  it('debería retornar null si buscarPorId no encuentra', async () => {
    const cola = new InMemoryColaSincronizacion();
    const r = await cola.buscarPorId('no-existe');
    expect(r).toBeNull();
  });
});
