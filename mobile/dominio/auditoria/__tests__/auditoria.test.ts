/**
 * Módulo AUDITORIA — Eventos inmutables encadenados
 * Ciclo 26: Crear evento LIQUIDACION_CREADA con hash propio
 */

import { registrarEvento } from '../auditoria';
import type { Hasher, IdGenerator } from '../../shared/ports';

// Hasher determinista por contenido (no crypto real, pero estable: mismo input → mismo hash).
// Necesario para que verificarCadena pueda recalcular y comparar.
function fakeChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
let _seqId = 0;
const hasher: Hasher = { sha256: (input: string) => `hash-fake-${fakeChecksum(input)}` };
const idGen: IdGenerator = { uuid: () => `uuid-fake-${String(++_seqId).padStart(4, '0')}` };
beforeEach(() => { _seqId = 0; });

describe('registrarEvento - LIQUIDACION_CREADA', () => {
  const actorMock = { id: 'USR-001', rol: 'OPERARIO' };

  it('usa el Hasher e IdGenerator inyectados (no crypto built-in)', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

    expect(evento.id).toBe('uuid-fake-0001');
    expect(evento.hash.startsWith('hash-fake-')).toBe(true);
  });

  it('debería crear un evento con id, timestamp, actor, tipo y payload', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

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
    }, hasher, idGen);

    expect(evento.hash).toBeDefined();
    expect(evento.hash.length).toBeGreaterThan(0);
  });

  it('el primer evento de la cadena debería tener hashAnterior = null', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

    expect(evento.hashAnterior).toBeNull();
  });

  it('debería generar IDs y hashes distintos para eventos distintos', () => {
    const e1 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);
    const e2 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002', total: 18000 },
    }, hasher, idGen);

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
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

    const e2 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002', total: 18000 },
      hashAnterior: e1.hash,
    }, hasher, idGen);

    expect(e2.hashAnterior).toBe(e1.hash);
  });

  it('el hash del segundo evento debería depender del hashAnterior', () => {
    const e1 = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

    // Si encadenamos a e1.hash vs a un hash distinto, los hashes finales deben diferir
    const e2a = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002', total: 18000 },
      hashAnterior: e1.hash,
    }, hasher, idGen);

    const e2b = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-002', total: 18000 },
      hashAnterior: 'hash-diferente-falso',
    }, hasher, idGen);

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
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

    expect(Object.isFrozen(evento)).toBe(true);
  });

  it('el actor y payload anidados también deberían estar congelados', () => {
    const evento = registrarEvento({
      tipo: 'EVIDENCIA_REGISTRADA',
      actor: actorMock,
      payload: { suscriptorId: 'SUSC-001', hashFoto: 'abc123', gps: { lat: 4.6, lng: -74.08 } },
    }, hasher, idGen);

    expect(Object.isFrozen(evento.actor)).toBe(true);
    expect(Object.isFrozen(evento.payload)).toBe(true);
    expect(Object.isFrozen((evento.payload as any).gps)).toBe(true);
  });

  it('debería lanzar TypeError al intentar modificar campos en strict mode', () => {
    const evento = registrarEvento({
      tipo: 'LIQUIDACION_CREADA',
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

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
        payload: { liquidacionId: `LIQ-${String(i).padStart(3, '0')}`, total: 17000 },
        hashAnterior,
      }, hasher, idGen);
      eventos.push(e);
      hashAnterior = e.hash;
    }

    return eventos;
  }

  it('debería retornar { valida: true } para una cadena vacía', () => {
    const { verificarCadena } = require('../auditoria');
    const resultado = verificarCadena([], hasher);

    expect(resultado.valida).toBe(true);
  });

  it('debería retornar { valida: true } para una cadena correcta de 1 evento', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(1);

    expect(verificarCadena(cadena, hasher).valida).toBe(true);
  });

  it('debería retornar { valida: true } para una cadena correcta de 5 eventos', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(5);

    expect(verificarCadena(cadena, hasher).valida).toBe(true);
  });

  it('debería retornar { valida: false, razon: "PRIMER_EVENTO_HASH_ANTERIOR_NO_NULO" } si el primer evento tiene hashAnterior', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(2);
    // Forzamos primer evento con hashAnterior no nulo (simulando manipulación)
    const cadenaInvalida = [{ ...cadena[0], hashAnterior: 'falso' }, cadena[1]];

    const resultado = verificarCadena(cadenaInvalida, hasher);
    expect(resultado.valida).toBe(false);
    expect(resultado.razon).toBe('PRIMER_EVENTO_HASH_ANTERIOR_NO_NULO');
  });

  it('debería detectar cuando se borró un evento del medio (cadena rota)', () => {
    const { verificarCadena } = require('../auditoria');
    const cadena = construirCadena(5);

    // Eliminamos el evento del medio
    const cadenaRota = [cadena[0], cadena[1], cadena[3], cadena[4]];

    const resultado = verificarCadena(cadenaRota, hasher);
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

    const resultado = verificarCadena(cadenaManipulada, hasher);
    expect(resultado.valida).toBe(false);
    expect(resultado.razon).toBe('HASH_INVALIDO');
    expect(resultado.indice).toBe(1);
  });
});

// Ciclos 31 y 32: Eventos tipados (discriminated union)
describe('eventos tipados (discriminated union)', () => {
  const actorMock = { id: 'USR-001', rol: 'OPERARIO' };

  it('LIQUIDACION_CREADA debería exigir { liquidacionId, total }', () => {
    const { registrarLiquidacionCreada } = require('../auditoria');
    const evento = registrarLiquidacionCreada({
      actor: actorMock,
      payload: { liquidacionId: 'LIQ-001', total: 17000 },
    }, hasher, idGen);

    expect(evento.tipo).toBe('LIQUIDACION_CREADA');
    expect(evento.payload.liquidacionId).toBe('LIQ-001');
    expect(evento.payload.total).toBe(17000);
  });

  it('LIQUIDACION_ANULADA debería exigir { liquidacionAnuladaId, liquidacionNuevaId, motivo }', () => {
    const { registrarLiquidacionAnulada } = require('../auditoria');
    const evento = registrarLiquidacionAnulada({
      actor: actorMock,
      payload: {
        liquidacionAnuladaId: 'LIQ-001',
        liquidacionNuevaId: 'LIQ-002',
        motivo: 'Error en lectura',
      },
    }, hasher, idGen);

    expect(evento.tipo).toBe('LIQUIDACION_ANULADA');
    expect(evento.payload.motivo).toBe('Error en lectura');
  });

  it('LECTURA_CAPTURADA debería exigir { suscriptorId, lecturaActual, fechaLectura }', () => {
    const { registrarLecturaCapturada } = require('../auditoria');
    const fecha = new Date('2026-04-27T10:00:00Z');
    const evento = registrarLecturaCapturada({
      actor: actorMock,
      payload: { suscriptorId: 'SUSC-001', lecturaActual: 1234, fechaLectura: fecha },
    }, hasher, idGen);

    expect(evento.tipo).toBe('LECTURA_CAPTURADA');
    expect(evento.payload.lecturaActual).toBe(1234);
  });

  it('EVIDENCIA_REGISTRADA debería exigir { suscriptorId, hashFoto, gps? }', () => {
    const { registrarEvidenciaRegistrada } = require('../auditoria');
    const evento = registrarEvidenciaRegistrada({
      actor: actorMock,
      payload: {
        suscriptorId: 'SUSC-001',
        hashFoto: 'abc123',
        gps: { lat: 4.6, lng: -74.08 },
      },
    }, hasher, idGen);

    expect(evento.tipo).toBe('EVIDENCIA_REGISTRADA');
    expect(evento.payload.hashFoto).toBe('abc123');
  });

  it('INTEGRIDAD_VIOLADA debería exigir { entidadTipo, entidadId, hashEsperado, hashRecibido }', () => {
    const { registrarIntegridadViolada } = require('../auditoria');
    const evento = registrarIntegridadViolada({
      actor: actorMock,
      payload: {
        entidadTipo: 'Liquidacion',
        entidadId: 'LIQ-001',
        hashEsperado: 'abc',
        hashRecibido: 'xyz',
      },
    }, hasher, idGen);

    expect(evento.tipo).toBe('INTEGRIDAD_VIOLADA');
    expect(evento.payload.entidadTipo).toBe('Liquidacion');
  });
});
