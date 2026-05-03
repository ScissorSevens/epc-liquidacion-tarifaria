/**
 * Sincronización — extensiones para item tipo 'FACTURA'
 * Phase 9 del change aggregate-factura
 */

import { agregarItemACola } from '../cola';
import { InMemoryColaSincronizacion } from '../cola-repository';
import { procesarCola, resolverConflicto } from '../procesador';
import type { ClienteSincronizacion } from '../procesador';
import type { TipoItem } from '../types';

describe('TipoItem extendido con FACTURA', () => {
  it('debería aceptar tipo "FACTURA" al armar un item de cola', () => {
    const item = agregarItemACola({
      tipo: 'FACTURA',
      payload: { id: 'FAC-001', numeroFactura: 'MZ-001-2981' },
      hashLocal: 'hashFactura',
    });

    expect(item.tipo).toBe('FACTURA');
    expect(item.estado).toBe('PENDIENTE');
  });

  it('"FACTURA" debería ser asignable al tipo TipoItem', () => {
    const t: TipoItem = 'FACTURA';
    expect(t).toBe('FACTURA');
  });
});

describe('FACTURA con dependeDe LIQUIDACION', () => {
  it('item FACTURA con dependeDe a LIQUIDACION pendiente NO se envía hasta que la dependencia sea EXITOSO', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const itemLiq = agregarItemACola({
      tipo: 'LIQUIDACION',
      payload: { id: 'LIQ-001', total: 17000 },
      hashLocal: 'hashLiq',
    });
    await cola.guardar(itemLiq);

    const itemFac = agregarItemACola({
      tipo: 'FACTURA',
      payload: { id: 'FAC-001', numeroFactura: 'MZ-001-2981' },
      hashLocal: 'hashFac',
      dependeDe: [itemLiq.id],
    });
    await cola.guardar(itemFac);

    await procesarCola(cola, cliente);

    // Liquidacion enviada y exitosa, factura tambien (porque dep se resuelve en el mismo run)
    expect(cliente.enviar).toHaveBeenCalledTimes(2);
    const facActualizada = await cola.buscarPorId(itemFac.id);
    expect(facActualizada?.estado).toBe('EXITOSO');
  });

  it('item FACTURA queda PENDIENTE si su dependencia LIQUIDACION está FALLIDA', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const itemLiqFallido = {
      ...agregarItemACola({
        tipo: 'LIQUIDACION',
        payload: { id: 'LIQ-002', total: 18000 },
        hashLocal: 'hashLiq2',
      }),
      estado: 'FALLIDO' as const,
    };
    await cola.guardar(itemLiqFallido);

    const itemFac = agregarItemACola({
      tipo: 'FACTURA',
      payload: { id: 'FAC-002', numeroFactura: 'MZ-001-2982' },
      hashLocal: 'hashFac2',
      dependeDe: [itemLiqFallido.id],
    });
    await cola.guardar(itemFac);

    await procesarCola(cola, cliente);

    // FACTURA no se envia porque su dependencia no esta EXITOSO
    expect(cliente.enviar).not.toHaveBeenCalled();
    const facActualizada = await cola.buscarPorId(itemFac.id);
    expect(facActualizada?.estado).toBe('PENDIENTE');
  });
});

describe('FACTURA conflicto por hash mismatch', () => {
  it('item FACTURA cuyo backend responde conflicto pasa a CONFLICTO con hashServer', async () => {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({
        ok: false,
        conflicto: true,
        hashServer: 'hashRemotoDistinto',
      }),
    };

    const itemFac = agregarItemACola({
      tipo: 'FACTURA',
      payload: { id: 'FAC-100', numeroFactura: 'MZ-001-2999' },
      hashLocal: 'hashLocal',
    });
    await cola.guardar(itemFac);

    await procesarCola(cola, cliente);

    const facActualizada = await cola.buscarPorId(itemFac.id);
    expect(facActualizada?.estado).toBe('CONFLICTO');
    expect(facActualizada?.hashServer).toBe('hashRemotoDistinto');
    expect(facActualizada?.intentos).toBe(0); // conflicto no incrementa intentos
  });
});

describe('DecisionConflicto sobre FACTURA', () => {
  async function ponerFacturaEnConflicto() {
    const cola = new InMemoryColaSincronizacion();
    const cliente: ClienteSincronizacion = {
      enviar: jest.fn().mockResolvedValue({
        ok: false,
        conflicto: true,
        hashServer: 'remoto',
      }),
    };
    const item = agregarItemACola({
      tipo: 'FACTURA',
      payload: { id: 'FAC-300', numeroFactura: 'MZ-001-3000' },
      hashLocal: 'local',
    });
    await cola.guardar(item);
    await procesarCola(cola, cliente);
    return { cola, item };
  }

  it('SOBRESCRIBIR_LOCAL reencola FACTURA como PENDIENTE con forzarSobrescribir', async () => {
    const { cola, item } = await ponerFacturaEnConflicto();

    await resolverConflicto(cola, item.id, 'SOBRESCRIBIR_LOCAL');

    const resuelto = await cola.buscarPorId(item.id);
    expect(resuelto?.estado).toBe('PENDIENTE');
    expect(resuelto?.forzarSobrescribir).toBe(true);
    expect(resuelto?.intentos).toBe(0);
  });

  it('SOBRESCRIBIR_SERVER marca FACTURA como EXITOSO', async () => {
    const { cola, item } = await ponerFacturaEnConflicto();

    await resolverConflicto(cola, item.id, 'SOBRESCRIBIR_SERVER');

    const resuelto = await cola.buscarPorId(item.id);
    expect(resuelto?.estado).toBe('EXITOSO');
  });

  it('DESCARTAR marca FACTURA como DESCARTADO', async () => {
    const { cola, item } = await ponerFacturaEnConflicto();

    await resolverConflicto(cola, item.id, 'DESCARTAR');

    const resuelto = await cola.buscarPorId(item.id);
    expect(resuelto?.estado).toBe('DESCARTADO');
  });
});
