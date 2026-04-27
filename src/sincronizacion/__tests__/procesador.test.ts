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

// Ciclo 36: Manejo de error - intentos++ y ultimoError
describe('procesarCola - manejo de error', () => {
  it('debería incrementar intentos cuando el cliente falla', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockRejectedValue(new Error('Network down')),
    };

    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'abc',
    });
    await cola.guardar(item);

    await procesarCola(cola, cliente);

    const actualizado = await cola.buscarPorId(item.id);
    expect(actualizado?.intentos).toBe(1);
    expect(actualizado?.ultimoError).toBe('Network down');
    expect(actualizado?.estado).toBe('PENDIENTE');
  });

  it('debería marcar como PENDIENTE cuando server responde ok=false (no exitoso, no excepción)', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: false, error: 'Server 500' }),
    };

    const item = agregarItemACola({
      tipo: 'LECTURA',
      payload: { v: 1 },
      hashLocal: 'a',
    });
    await cola.guardar(item);

    await procesarCola(cola, cliente);

    const actualizado = await cola.buscarPorId(item.id);
    expect(actualizado?.estado).toBe('PENDIENTE');
    expect(actualizado?.intentos).toBe(1);
    expect(actualizado?.ultimoError).toBe('Server 500');
  });
});

// Ciclo 37: Reintentos exponenciales (función pura)
describe('calcularDelayReintento', () => {
  it('debería retornar 1000ms para el intento 1', () => {
    const { calcularDelayReintento } = require('../reintentos');
    expect(calcularDelayReintento(1)).toBe(1000);
  });

  it('debería retornar 2000ms para el intento 2', () => {
    const { calcularDelayReintento } = require('../reintentos');
    expect(calcularDelayReintento(2)).toBe(2000);
  });

  it('debería retornar 4000ms para el intento 3 (exponencial base 2)', () => {
    const { calcularDelayReintento } = require('../reintentos');
    expect(calcularDelayReintento(3)).toBe(4000);
  });

  it('debería retornar 8000ms para el intento 4', () => {
    const { calcularDelayReintento } = require('../reintentos');
    expect(calcularDelayReintento(4)).toBe(8000);
  });

  it('debería retornar 16000ms para el intento 5', () => {
    const { calcularDelayReintento } = require('../reintentos');
    expect(calcularDelayReintento(5)).toBe(16000);
  });

  it('debería tirar error si intentos < 1', () => {
    const { calcularDelayReintento } = require('../reintentos');
    expect(() => calcularDelayReintento(0)).toThrow();
  });
});

describe('procesarCola - respeto de delay entre reintentos', () => {
  it('NO debería reintentar un item si no pasó el delay desde el último intento', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    // Item ya intentado 1 vez hace 100ms — el delay para intento 1 es 1000ms
    const itemReciente = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      intentos: 1,
      ultimoError: 'Network down',
      ultimoIntentoEn: new Date(Date.now() - 100),
    };
    await cola.guardar(itemReciente);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).not.toHaveBeenCalled();
  });

  it('SÍ debería reintentar si pasó el delay', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    // Item intentado hace 2 segundos, delay para intento 1 es 1s — debe reintentarse
    const itemListo = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      intentos: 1,
      ultimoError: 'Network down',
      ultimoIntentoEn: new Date(Date.now() - 2000),
    };
    await cola.guardar(itemListo);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).toHaveBeenCalledTimes(1);
  });
});

// Ciclo 38: Límite de reintentos
describe('procesarCola - límite de reintentos', () => {
  it('debería marcar item como FALLIDO después de 5 intentos', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockRejectedValue(new Error('Persistent error')),
    };

    // Item con 4 intentos previos, listo para reintentarse
    const item = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      intentos: 4,
      ultimoError: 'Network down',
      ultimoIntentoEn: new Date(Date.now() - 60000),
    };
    await cola.guardar(item);

    await procesarCola(cola, cliente);

    const actualizado = await cola.buscarPorId(item.id);
    expect(actualizado?.intentos).toBe(5);
    expect(actualizado?.estado).toBe('FALLIDO');
  });

  it('NO debería reintentar items ya en estado FALLIDO', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const fallido = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      estado: 'FALLIDO' as const,
      intentos: 5,
    };
    await cola.guardar(fallido);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).not.toHaveBeenCalled();
  });
});

// Ciclo 39: Resiliencia - una falla NO bloquea otros items
describe('procesarCola - resiliencia entre items', () => {
  it('si un item falla, debería seguir procesando los demás', async () => {
    const cola = new InMemoryColaSincronizacion();

    const itemBueno = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'OK' },
      hashLocal: 'ok',
    });
    const itemMalo = agregarItemACola({
      tipo: 'EVIDENCIA',
      payload: { id: 'FAIL' },
      hashLocal: 'fail',
    });
    const itemBueno2 = agregarItemACola({
      tipo: 'LECTURA',
      payload: { id: 'OK2' },
      hashLocal: 'ok2',
    });

    await cola.guardar(itemBueno);
    await cola.guardar(itemMalo);
    await cola.guardar(itemBueno2);

    // Cliente que falla SOLO con el itemMalo
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockImplementation((item) => {
        if (item.hashLocal === 'fail') {
          return Promise.reject(new Error('Boom'));
        }
        return Promise.resolve({ ok: true });
      }),
    };

    await procesarCola(cola, cliente);

    expect(cliente.enviar).toHaveBeenCalledTimes(3);

    const r1 = await cola.buscarPorId(itemBueno.id);
    const r2 = await cola.buscarPorId(itemMalo.id);
    const r3 = await cola.buscarPorId(itemBueno2.id);

    expect(r1?.estado).toBe('EXITOSO');
    expect(r2?.estado).toBe('PENDIENTE');
    expect(r2?.intentos).toBe(1);
    expect(r3?.estado).toBe('EXITOSO');
  });
});

// Ciclo 40: Detección de conflicto (server responde con hash distinto)
describe('procesarCola - detección de conflicto', () => {
  it('debería marcar item como CONFLICTO si server responde conflicto=true con hashServer distinto', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({
        ok: false,
        conflicto: true,
        hashServer: 'hash-del-server-distinto',
      }),
    };

    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'hash-local-mio',
    });
    await cola.guardar(item);

    await procesarCola(cola, cliente);

    const actualizado = await cola.buscarPorId(item.id);
    expect(actualizado?.estado).toBe('CONFLICTO');
    expect(actualizado?.hashServer).toBe('hash-del-server-distinto');
  });

  it('NO debería incrementar intentos cuando hay CONFLICTO (no es un error de red)', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({
        ok: false,
        conflicto: true,
        hashServer: 'otro-hash',
      }),
    };

    const item = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001' },
      hashLocal: 'mio',
    });
    await cola.guardar(item);

    await procesarCola(cola, cliente);

    const actualizado = await cola.buscarPorId(item.id);
    expect(actualizado?.intentos).toBe(0);
  });

  it('NO debería procesar items en estado CONFLICTO (esperan resolución manual)', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const enConflicto = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      estado: 'CONFLICTO' as const,
      hashServer: 'srv',
    };
    await cola.guardar(enConflicto);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).not.toHaveBeenCalled();
  });
});

// Ciclo 41: Resolución manual de conflicto
describe('resolverConflicto', () => {
  it('SOBRESCRIBIR_LOCAL debería forzar el envío del item local (vuelve a PENDIENTE)', async () => {
    const { resolverConflicto } = require('../procesador');
    const cola = new InMemoryColaSincronizacion();

    const enConflicto = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: { v: 1 }, hashLocal: 'mio' }),
      estado: 'CONFLICTO' as const,
      hashServer: 'srv',
      intentos: 0,
    };
    await cola.guardar(enConflicto);

    await resolverConflicto(cola, enConflicto.id, 'SOBRESCRIBIR_LOCAL');

    const actualizado = await cola.buscarPorId(enConflicto.id);
    expect(actualizado?.estado).toBe('PENDIENTE');
    expect(actualizado?.forzarSobrescribir).toBe(true);
  });

  it('DESCARTAR debería marcar el item como DESCARTADO (no se envía nunca más)', async () => {
    const { resolverConflicto } = require('../procesador');
    const cola = new InMemoryColaSincronizacion();

    const enConflicto = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      estado: 'CONFLICTO' as const,
      hashServer: 'srv',
    };
    await cola.guardar(enConflicto);

    await resolverConflicto(cola, enConflicto.id, 'DESCARTAR');

    const actualizado = await cola.buscarPorId(enConflicto.id);
    expect(actualizado?.estado).toBe('DESCARTADO');
  });

  it('SOBRESCRIBIR_SERVER debería marcar como EXITOSO (acepto la versión del server)', async () => {
    const { resolverConflicto } = require('../procesador');
    const cola = new InMemoryColaSincronizacion();

    const enConflicto = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      estado: 'CONFLICTO' as const,
      hashServer: 'srv',
    };
    await cola.guardar(enConflicto);

    await resolverConflicto(cola, enConflicto.id, 'SOBRESCRIBIR_SERVER');

    const actualizado = await cola.buscarPorId(enConflicto.id);
    expect(actualizado?.estado).toBe('EXITOSO');
  });

  it('debería tirar error si el item no existe', async () => {
    const { resolverConflicto } = require('../procesador');
    const cola = new InMemoryColaSincronizacion();

    await expect(resolverConflicto(cola, 'no-existe', 'DESCARTAR')).rejects.toThrow();
  });

  it('debería tirar error si el item no está en CONFLICTO', async () => {
    const { resolverConflicto } = require('../procesador');
    const cola = new InMemoryColaSincronizacion();

    const item = agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' });
    await cola.guardar(item);

    await expect(resolverConflicto(cola, item.id, 'DESCARTAR')).rejects.toThrow();
  });

  it('item con forzarSobrescribir=true debería enviarse al cliente y marcarse EXITOSO al volver a procesar', async () => {
    const { resolverConflicto } = require('../procesador');
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const enConflicto = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'a' }),
      estado: 'CONFLICTO' as const,
      hashServer: 'srv',
    };
    await cola.guardar(enConflicto);
    await resolverConflicto(cola, enConflicto.id, 'SOBRESCRIBIR_LOCAL');
    await procesarCola(cola, cliente);

    expect(cliente.enviar).toHaveBeenCalledTimes(1);
    const actualizado = await cola.buscarPorId(enConflicto.id);
    expect(actualizado?.estado).toBe('EXITOSO');
  });
});

// Ciclo 42: Orden de dependencias
describe('procesarCola - orden de dependencias (dependeDe)', () => {
  it('item con dependeDe NO debería enviarse si su dependencia aún está PENDIENTE', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockImplementation((item) => {
        // Falla la primera (la dependencia) — la segunda no debe enviarse
        if (item.hashLocal === 'dep') return Promise.reject(new Error('boom'));
        return Promise.resolve({ ok: true });
      }),
    };

    const dependencia = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001' },
      hashLocal: 'dep',
    });
    const dependiente = agregarItemACola({
      tipo: 'EVENTO_AUDITORIA',
      payload: { tipo: 'LIQUIDACION_ANULADA', referenciaA: 'LIQ-001' },
      hashLocal: 'anul',
      dependeDe: [dependencia.id],
    });

    await cola.guardar(dependencia);
    await cola.guardar(dependiente);

    await procesarCola(cola, cliente);

    // Solo se intentó enviar la dependencia (que falló)
    expect(cliente.enviar).toHaveBeenCalledTimes(1);
    expect(cliente.enviar).toHaveBeenCalledWith(expect.objectContaining({ hashLocal: 'dep' }));

    const dep = await cola.buscarPorId(dependiente.id);
    expect(dep?.estado).toBe('PENDIENTE');
    expect(dep?.intentos).toBe(0); // no se intentó
  });

  it('item con dependeDe SÍ debería enviarse cuando su dependencia está EXITOSA', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const dependencia = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001' },
      hashLocal: 'dep',
    });
    const dependiente = agregarItemACola({
      tipo: 'EVENTO_AUDITORIA',
      payload: { tipo: 'LIQUIDACION_ANULADA' },
      hashLocal: 'anul',
      dependeDe: [dependencia.id],
    });

    await cola.guardar(dependencia);
    await cola.guardar(dependiente);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).toHaveBeenCalledTimes(2);
    const items = await cola.listar();
    expect(items.every((i) => i.estado === 'EXITOSO')).toBe(true);
  });

  it('item NO debería enviarse si alguna dependencia está FALLIDA', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const fallido = {
      ...agregarItemACola({ tipo: 'LIQUIDACION', payload: {}, hashLocal: 'f' }),
      estado: 'FALLIDO' as const,
      intentos: 5,
    };
    const dependiente = agregarItemACola({
      tipo: 'EVENTO_AUDITORIA',
      payload: {},
      hashLocal: 'anul',
      dependeDe: [fallido.id],
    });

    await cola.guardar(fallido);
    await cola.guardar(dependiente);

    await procesarCola(cola, cliente);

    expect(cliente.enviar).not.toHaveBeenCalled();
    const dep = await cola.buscarPorId(dependiente.id);
    expect(dep?.estado).toBe('PENDIENTE');
  });
});
