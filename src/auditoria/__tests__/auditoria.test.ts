/**
 * Módulo AUDITORIA — Eventos inmutables encadenados
 * Ciclo 26: Crear evento LIQUIDACION_CREADA con hash propio
 */

import { registrarEvento } from '../auditoria';

describe('registrarEvento - LIQUIDACION_CREADA', () => {
  const actorMock = { id: 'USR-001', rol: 'OPERARIO' };

  it('debería crear un evento con id, timestamp, actor, tipo y payload', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    });

    expect(evento.id).toBeDefined();
    expect(typeof evento.id).toBe('string');
    expect(evento.timestamp).toBeInstanceOf(Date);
    expect(evento.actor).toEqual(actorMock);
    expect(evento.tipo).toBe('LIQUIDACION_CREADA');
    expect(evento.payload).toEqual({ liquidacionId: 'LIQ-001', total: 17000 });
  });

  it('debería generar un hash SHA-256 propio del evento', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    });

    expect(evento.hash).toBeDefined();
    expect(evento.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('el primer evento de la cadena debería tener hashAnterior = null', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    });

    expect(evento.hashAnterior).toBeNull();
  });

  it('debería generar IDs y hashes distintos para eventos distintos', () => {
    const e1 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    });
    const e2 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002', total: 18000 },
    });

    expect(e1.id).not.toBe(e2.id);
    expect(e1.hash).not.toBe(e2.hash);
  });
});

// Ciclo 27: Encadenamiento de eventos
describe('encadenamiento de eventos', () => {
  const actorMock = { id: 'USR-001', rol: 'OPERARIO' };

  it('el segundo evento debería incluir el hash del primero como hashAnterior', () => {
    const e1 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001' },
    });

    const e2 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002' },
      hashAnterior: e1.hash,
    });

    expect(e2.hashAnterior).toBe(e1.hash);
  });

  it('el hash del segundo evento debería depender del hashAnterior', () => {
    const e1 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001' },
    });

    // Si encadenamos a e1.hash vs a un hash distinto, los hashes finales deben diferir
    const e2a = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002' },
      hashAnterior: e1.hash,
    });

    const e2b = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002' },
      hashAnterior: 'hash-diferente-falso',
    });

    expect(e2a.hash).not.toBe(e2b.hash);
  });
});
