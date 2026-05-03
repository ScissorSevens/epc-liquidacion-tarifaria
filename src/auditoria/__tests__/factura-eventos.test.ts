/**
 * Módulo AUDITORIA — variantes FACTURA_EMITIDA y FACTURA_ANULADA
 * Phase 8 del change aggregate-factura
 */

import { registrarEvento, verificarCadena } from '../auditoria';

const actorMock = { id: 'USR-001', rol: 'OPERARIO' };

describe('evento FACTURA_EMITIDA', () => {
  it('debería registrar un evento FACTURA_EMITIDA con payload tipado', () => {
    const { registrarFacturaEmitida } = require('../auditoria');
    const evento = registrarFacturaEmitida({
      actor: actorMock,
      payload: {
        facturaId: 'FAC-001',
        numeroFactura: 'MZ-001-2981',
        suscriptorId: 5,
        total: 45000,
      },
    });

    expect(evento.tipo).toBe('FACTURA_EMITIDA');
    expect(evento.payload.facturaId).toBe('FAC-001');
    expect(evento.payload.numeroFactura).toBe('MZ-001-2981');
    expect(evento.payload.suscriptorId).toBe(5);
    expect(evento.payload.total).toBe(45000);
    expect(evento.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('FACTURA_EMITIDA debería poder usarse en registrarEvento genérico', () => {
    const evento = registrarEvento({
      tipo: 'FACTURA_EMITIDA',
      actor: actorMock,
      payload: {
        facturaId: 'FAC-002',
        numeroFactura: 'MZ-001-2982',
        suscriptorId: 7,
        total: 17000,
      },
    });

    expect(evento.tipo).toBe('FACTURA_EMITIDA');
    expect(evento.hashAnterior).toBeNull();
  });
});
