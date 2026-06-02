/**
 * Tests del parser CSV de importacion suscriptor+medidor.
 *
 * Header esperado (en orden estricto):
 *   codigo,nombre_apellidos,direccion,estrato,matricula_inmobiliaria,
 *   numero_catastral,numero_medidor,fecha_instalacion,observaciones_medidor
 *
 * Politica de errores: un error por linea NO aborta el parseo; se
 * acumulan en `errores` y las filas validas siguen en `filas`.
 */

import { parsearCSV } from '../parser-csv';

const HEADER =
  'codigo,nombre_apellidos,direccion,estrato,matricula_inmobiliaria,numero_catastral,numero_medidor,fecha_instalacion,observaciones_medidor';

describe('parsearCSV', () => {
  it('CSV totalmente vacio -> error de header faltante', () => {
    const r = parsearCSV('');
    expect(r.filas).toEqual([]);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.linea).toBe(1);
    expect(r.errores[0]?.mensaje).toMatch(/header/i);
  });

  it('header invalido -> error de header con detalle', () => {
    const r = parsearCSV('codigo,nombre,bla\n');
    expect(r.filas).toEqual([]);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.linea).toBe(1);
    expect(r.errores[0]?.mensaje).toMatch(/header/i);
  });

  it('header valido + 0 filas -> ResultadoParseo vacio sin errores', () => {
    const r = parsearCSV(HEADER + '\n');
    expect(r.filas).toEqual([]);
    expect(r.errores).toEqual([]);
  });

  it('1 fila valida -> 1 fila parseada con todos los campos', () => {
    const csv =
      HEADER +
      '\n0001,Juan Perez,Calle 1,3,MAT-1,CAT-1,M-001,2024-01-15,obs uno\n';
    const r = parsearCSV(csv);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toEqual({
      linea: 2,
      codigo: '0001',
      nombre_apellidos: 'Juan Perez',
      direccion: 'Calle 1',
      estrato: 3,
      matricula_inmobiliaria: 'MAT-1',
      numero_catastral: 'CAT-1',
      numero_medidor: 'M-001',
      fecha_instalacion: '2024-01-15',
      observaciones_medidor: 'obs uno',
    });
  });

  it('campos opcionales vacios quedan undefined (no string vacio)', () => {
    const csv = HEADER + '\n0001,Juan,Calle,3,,,M-1,2024-01-15,\n';
    const r = parsearCSV(csv);
    expect(r.errores).toEqual([]);
    expect(r.filas[0]?.matricula_inmobiliaria).toBeUndefined();
    expect(r.filas[0]?.numero_catastral).toBeUndefined();
    expect(r.filas[0]?.observaciones_medidor).toBeUndefined();
  });

  it('estrato fuera de rango (no entero entre 1-6) -> error con linea', () => {
    const csv = HEADER + '\n0001,Juan,Calle,7,,,M-1,2024-01-15,\n';
    const r = parsearCSV(csv);
    expect(r.filas).toEqual([]);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.linea).toBe(2);
    expect(r.errores[0]?.mensaje).toMatch(/estrato/i);
  });

  it('estrato no numerico -> error con linea', () => {
    const csv = HEADER + '\n0001,Juan,Calle,abc,,,M-1,2024-01-15,\n';
    const r = parsearCSV(csv);
    expect(r.filas).toEqual([]);
    expect(r.errores[0]?.mensaje).toMatch(/estrato/i);
  });

  it('fecha mal formateada -> error con linea', () => {
    const csv = HEADER + '\n0001,Juan,Calle,3,,,M-1,15-01-2024,\n';
    const r = parsearCSV(csv);
    expect(r.filas).toEqual([]);
    expect(r.errores[0]?.linea).toBe(2);
    expect(r.errores[0]?.mensaje).toMatch(/fecha/i);
  });

  it('campo entre comillas con coma adentro -> OK', () => {
    const csv =
      HEADER +
      '\n0001,"Juan, Perez","Calle 1, casa 2",3,,,M-1,2024-01-15,\n';
    const r = parsearCSV(csv);
    expect(r.errores).toEqual([]);
    expect(r.filas[0]?.nombre_apellidos).toBe('Juan, Perez');
    expect(r.filas[0]?.direccion).toBe('Calle 1, casa 2');
  });

  it('cantidad de columnas distinta del header -> error con linea', () => {
    const csv = HEADER + '\n0001,Juan,Calle,3\n';
    const r = parsearCSV(csv);
    expect(r.filas).toEqual([]);
    expect(r.errores[0]?.linea).toBe(2);
    expect(r.errores[0]?.mensaje).toMatch(/columnas|campos/i);
  });

  it('3 filas (1 ok, 2 con errores) -> contadores correctos', () => {
    const csv =
      HEADER +
      '\n0001,Juan,Calle,3,,,M-1,2024-01-15,\n' +
      '0002,Pedro,Calle,9,,,M-2,2024-01-15,\n' +
      '0003,Ana,Calle,2,,,M-3,2024/01/15,\n';
    const r = parsearCSV(csv);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]?.codigo).toBe('0001');
    expect(r.errores).toHaveLength(2);
    expect(r.errores[0]?.linea).toBe(3);
    expect(r.errores[1]?.linea).toBe(4);
  });

  it('lineas vacias se ignoran (no producen filas ni errores)', () => {
    const csv =
      HEADER + '\n\n0001,Juan,Calle,3,,,M-1,2024-01-15,\n\n';
    const r = parsearCSV(csv);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(1);
  });

  it('soporta CRLF como separador de linea', () => {
    const csv = HEADER + '\r\n0001,Juan,Calle,3,,,M-1,2024-01-15,\r\n';
    const r = parsearCSV(csv);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(1);
  });
});
