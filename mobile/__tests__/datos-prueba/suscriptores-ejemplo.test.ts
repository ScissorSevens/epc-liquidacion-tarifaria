/**
 * Test del CSV de ejemplo: suscriptores_ejemplo.csv debe ser parseable
 * sin errores por el parser nuevo (9 cols con cedula+municipio).
 *
 * Si este test rompe, el CSV de ejemplo está desincronizado con el
 * header que anuncia la UI — bug histórico de COR-09.
 *
 * Para mantener sincronía entre el archivo en disco y los tests de
 * string-compare, regenera manualmente el CSV con la misma lista
 * de columnas que HEADER_NUEVO (parser-csv.ts).
 */

import * as fs from 'fs';
import * as path from 'path';
import { parsearCSV } from '../../dominio/importacion/parser-csv';
import { HEADER_NUEVO } from '../../dominio/importacion/parser-csv';

describe('suscriptores_ejemplo.csv (COR-09)', () => {
  const rutaCsv = path.resolve(
    __dirname,
    '..',
    '..',
    'suscriptores_ejemplo.csv',
  );

  function leerCsv(): string {
    return fs.readFileSync(rutaCsv, 'utf-8');
  }

  it('el archivo existe en la raíz del proyecto mobile', () => {
    expect(fs.existsSync(rutaCsv)).toBe(true);
  });

  it('la primera línea del CSV coincide exactamente con HEADER_NUEVO', () => {
    const csv = leerCsv();
    const primeraLinea = csv.split(/\r?\n/)[0] ?? '';
    const tokensCsv = primeraLinea.split(',').map((s) => s.trim());
    expect(tokensCsv).toEqual([...HEADER_NUEVO]);
  });

  it('al menos 3 filas válidas (CSV de ejemplo no está vacío)', () => {
    const csv = leerCsv();
    const r = parsearCSV(csv);
    expect(r.errores).toEqual([]);
    expect(r.filas.length).toBeGreaterThanOrEqual(3);
  });

  it('cada fila tiene cedula y municipio no vacíos (dominio crearSuscriptor los exige)', () => {
    const csv = leerCsv();
    const r = parsearCSV(csv);
    for (const fila of r.filas) {
      expect(fila.cedula).toBeDefined();
      expect(fila.cedula).not.toBe('');
      expect(fila.municipio).toBeDefined();
      expect(fila.municipio).not.toBe('');
    }
  });

  it('las cédulas matchean /^\d{6,12}$/ (validación de dominio)', () => {
    const csv = leerCsv();
    const r = parsearCSV(csv);
    for (const fila of r.filas) {
      expect(fila.cedula).toMatch(/^\d{6,12}$/);
    }
  });
});
