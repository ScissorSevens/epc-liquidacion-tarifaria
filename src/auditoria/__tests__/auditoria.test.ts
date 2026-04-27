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

// Ciclo 28: Inmutabilidad runtime
describe('inmutabilidad runtime de eventos', () => {
  const actorMock = { id: 'USR-001', rol: 'OPERARIO' };

  it('el evento debería estar congelado al nivel raíz', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001' },
    });

    expect(Object.isFrozen(evento)).toBe(true);
  });

  it('el actor y payload anidados también deberían estar congelados', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', detalles: { total: 17000 } },
    });

    expect(Object.isFrozen(evento.actor)).toBe(true);
    expect(Object.isFrozen(evento.payload)).toBe(true);
    expect(Object.isFrozen((evento.payload as any).detalles)).toBe(true);
  });

  it('debería lanzar TypeError al intentar modificar campos en strict mode', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001' },
    });

    expect(() => {
      (evento as any).tipo = 'INTEGRIDAD_VIOLADA';
    }).toThrow(TypeError);

    expect(() => {
      (evento.payload as any).liquidacionId = 'HACKED';
    }).toThrow(TypeError);
  });
});

// Ciclos 29 y 30: verificarCadena
describe('verificarCadena', () => {
  const actorMock = { id: 'USR-001', rol: 'OPERARIO' };

  function construirCadena(n: number) {
    const eventos = [];
    let hashAnterior: string | null = null;

    for (let i = 0; i < n; i++) {
      const e = registrarEvento({
        tipo: 'LIQUIDACION_CREADA',
        actor: actorMock,
        payload: { liquidacionId: `LIQ-${String(i).padStart(3, '0')}` },
        hashAnterior,
      });
      eventos.push(e);
      hashAnterior = e.hash;
    }

    return eventos;
  }

  it('debería retornar { valida: true } para una cadena vacía', () => {
    const { verificarCadena } = require('../auditoria');
    const resultado = verificarCadena([]);

    expect(resultado.valida).toBe(true);
  });

  it('debería retornar { valida: true } para una cadena correcta de 1 evento', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(1);

    expect(verificarCadena(cadena).valida).toBe(true);
  });

  it('debería retornar { valida: true } para una cadena correcta de 5 eventos', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(5);

    expect(verificarCadena(cadena).valida).toBe(true);
  });

  it('debería retornar { valida: false, razon: "PRIMER_EVENTO_HASH_ANTERIOR_NO_NULO" } si el primer evento tiene hashAnterior', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(2);
    // Forzamos primer evento con hashAnterior no nulo (simulando manipulación)
    const cadenaInvalida = [{ ...cadena[0], hashAnterior: 'falso' }, cadena[1]];

    const resultado = verificarCadena(cadenaInvalida);
    expect(resultado.valida).toBe(false);
    expect(resultado.razon).toBe('PRIMER_EVENTO_HASH_ANTERIOR_NO_NULO');
  });

  it('debería detectar cuando se borró un evento del medio (cadena rota)', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(5);

    // Eliminamos el evento del medio
    const cadenaRota = [cadena[0], cadena[1], cadena[3], cadena[4]];

    const resultado = verificarCadena(cadenaRota);
    expect(resultado.valida).toBe(false);
    expect(resultado.razon).toBe('CADENA_ROTA');
    expect(resultado.indice).toBe(2); // el 3er evento (índice 2) tiene hashAnterior que no coincide
  });

  it('debería detectar cuando el contenido de un evento fue manipulado', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(3);

    // Manipulamos el payload del evento del medio (sin recalcular hash)
    const cadenaManipulada = [
      cadena[0],
      { ...cadena[1], payload: { liquidacionId: 'HACKED' } },
      cadena[2],
    ];

    const resultado = verificarCadena(cadenaManipulada);
    expect(resultado.valida).toBe(false);
    expect(resultado.razon).toBe('HASH_INVALIDO');
    expect(resultado.indice).toBe(1);
  });
});
