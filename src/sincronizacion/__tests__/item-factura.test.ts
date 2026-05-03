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
