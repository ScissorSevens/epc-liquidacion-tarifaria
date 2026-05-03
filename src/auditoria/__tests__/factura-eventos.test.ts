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

describe('evento FACTURA_ANULADA', () => {
  it('debería registrar FACTURA_ANULADA simple sin facturaNuevaId', () => {
    const { registrarFacturaAnulada } = require('../auditoria');
    const evento = registrarFacturaAnulada({
      actor: actorMock,
      payload: {
        facturaAnuladaId: 'FAC-001',
        motivo: 'Error de digitación',
      },
    });

    expect(evento.tipo).toBe('FACTURA_ANULADA');
    expect(evento.payload.facturaAnuladaId).toBe('FAC-001');
    expect(evento.payload.motivo).toBe('Error de digitación');
    expect(evento.payload.facturaNuevaId).toBeUndefined();
  });

  it('debería registrar FACTURA_ANULADA con reemplazo (facturaNuevaId)', () => {
    const { registrarFacturaAnulada } = require('../auditoria');
    const evento = registrarFacturaAnulada({
      actor: actorMock,
      payload: {
        facturaAnuladaId: 'FAC-001',
        facturaNuevaId: 'FAC-002',
        motivo: 'Liquidación reemplazada',
      },
    });

    expect(evento.payload.facturaNuevaId).toBe('FAC-002');
    expect(evento.payload.motivo).toBe('Liquidación reemplazada');
  });
});

describe('eventos de factura encadenados al hash chain', () => {
  it('FACTURA_EMITIDA y FACTURA_ANULADA encadenan correctamente y verificarCadena queda verde', () => {
    const { registrarFacturaEmitida, registrarFacturaAnulada } = require('../auditoria');

    const e1 = registrarFacturaEmitida({
      actor: actorMock,
      payload: {
        facturaId: 'FAC-100',
        numeroFactura: 'MZ-001-100',
        suscriptorId: 9,
        total: 50000,
      },
    });

    const e2 = registrarFacturaAnulada({
      actor: actorMock,
      payload: {
        facturaAnuladaId: 'FAC-100',
        motivo: 'Error de digitación',
      },
      hashAnterior: e1.hash,
    });

    expect(e2.hashAnterior).toBe(e1.hash);

    const resultado = verificarCadena([e1, e2]);
    expect(resultado.valida).toBe(true);
  });

  it('verificarCadena detecta tampering del motivo en un evento FACTURA_ANULADA', () => {
    const { registrarFacturaEmitida, registrarFacturaAnulada } = require('../auditoria');

    const e1 = registrarFacturaEmitida({
      actor: actorMock,
      payload: {
        facturaId: 'FAC-200',
        numeroFactura: 'MZ-001-200',
        suscriptorId: 4,
        total: 22000,
      },
    });

    const e2 = registrarFacturaAnulada({
      actor: actorMock,
      payload: {
        facturaAnuladaId: 'FAC-200',
        motivo: 'Original',
      },
      hashAnterior: e1.hash,
    });

    // Tampering: cambiamos motivo sin recalcular hash
    const cadenaManipulada = [e1, { ...e2, payload: { ...e2.payload, motivo: 'HACKED' } }];

    const resultado = verificarCadena(cadenaManipulada);
    expect(resultado.valida).toBe(false);
    if (resultado.valida) throw new Error('Esperaba cadena invalida');
    expect(resultado.razon).toBe('HASH_INVALIDO');
    expect(resultado.indice).toBe(1);
  });
});
