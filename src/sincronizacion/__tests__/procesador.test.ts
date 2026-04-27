/**
 * Procesador de la cola de sincronización
 */

import { agregarItemACola } from '../cola';
import { InMemoryColaSincronizacion } from '../cola-repository';
import { procesarCola } from '../procesador';
import type { ClienteSincronizacion } from '../procesador';

// Helper: crea un cliente mock con respuestas configurables
function clienteMockExitoso(): ClienteSincronizacion {
  return {
    enviar: jest.fn().mockResolvedValue({ ok: true }),
  };
}

describe('procesarCola - flujo exitoso', () => {
  it('debería enviar cada item PENDIENTE al cliente', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente = clienteMockExitoso();

    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'abc',
    });
    await cola.guardar(item);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).toHaveBeenCalledTimes(1);
    expect(cliente.enviar).toHaveBeenCalledWith(item);
  });

  it('debería marcar el item como EXITOSO si el cliente responde ok', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente = clienteMockExitoso();

    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'abc',
    });
    await cola.guardar(item);

    await procesarCola(cola, cliente);

    const actualizado = await cola.buscarPorId(item.id);
    expect(actualizado?.estado).toBe('EXITOSO');
  });

  it('NO debería enviar items que ya están EXITOSOS', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente = clienteMockExitoso();

    const itemExitoso = {
      ...agregarItemACola({
        tipo: 'LIQUIDACION',
        payload: { id: 'LIQ-001' },
        hashLocal: 'abc',
      }),
      estado: 'EXITOSO' as const,
    };
    await cola.guardar(itemExitoso);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).not.toHaveBeenCalled();
  });

  it('debería procesar múltiples items pendientes', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente = clienteMockExitoso();

    for (let i = 0; i < 3; i++) {
      await cola.guardar(
        agregarItemACola({
          tipo: 'LECTURA',
          payload: { v: i },
          hashLocal: `h${i}`,
        })
      );
    }

    await procesarCola(cola, cliente);

    expect(cliente.enviar).toHaveBeenCalledTimes(3);
    const items = await cola.listar();
    expect(items.every((i) => i.estado === 'EXITOSO')).toBe(true);
  });
});
