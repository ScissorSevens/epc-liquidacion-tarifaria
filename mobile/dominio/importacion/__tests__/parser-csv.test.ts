/**
 * Tests del parser CSV de importacion suscriptor+medidor.
 *
 * Headers aceptados (ver parser-csv.ts):
 *   - LEGACY (9 cols con codigo + numero_medidor): backward compat con
 *     CSVs generados por la app antes del multi-tenant (EPC-LEGACY).
 *   - NUEVO (9 cols con cedula + municipio): desde COR-09 el dominio
 *     `crearSuscriptor` exige ambos campos. La UI declara este header
 *     en `ImportarCsv.tsx`.
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

  // ─────────────────────────────────────────────────────────────────────
  // Header NUEVO con cedula + municipio (COR-09)
  //
  // Bug original: el dominio `crearSuscriptor` exige cedula y municipio
  // NO vacíos, pero el header NUEVO (7 cols) anunciado por la UI no los
  // traía. Cualquier CSV anunciado como "válido por la UI" fallaba al
  // persistir. Fix: header nuevo pasa a 9 columnas con cedula y municipio
  // en posiciones explícitas (entre nombre_apellidos y direccion), en
  // línea con `SuscriptorBorrador` (types.ts).
  // ─────────────────────────────────────────────────────────────────────
  const HEADER_NUEVO_9 =
    'nombre_apellidos,cedula,municipio,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor';

  describe('header NUEVO con cedula + municipio (COR-09)', () => {
    it('T-CSV-1 acepta header nuevo de 9 columnas y extrae cedula + municipio en cada fila', () => {
      const csv =
        HEADER_NUEVO_9 +
        '\n' +
        'Juan Perez,12345678,Bogotá,Calle 1,3,MAT-1,CAT-1,2024-01-15,obs uno';
      const r = parsearCSV(csv);

      expect(r.errores).toEqual([]);
      expect(r.filas).toHaveLength(1);
      expect(r.filas[0]).toMatchObject({
        linea: 2,
        nombre_apellidos: 'Juan Perez',
        cedula: '12345678',
        municipio: 'Bogotá',
        direccion: 'Calle 1',
        estrato: 3,
        fecha_instalacion: '2024-01-15',
        matricula_inmobiliaria: 'MAT-1',
        numero_catastral: 'CAT-1',
        observaciones_medidor: 'obs uno',
      });
    });

    it('T-CSV-2 rechaza CSV sin columna cedula en el header (header mismatch)', () => {
      // Header igual al NUEVO pero omitiendo `cedula` — debe ser rechazado.
      const headerInvalido =
        'nombre_apellidos,municipio,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor';
      const csv = headerInvalido + '\nJuan,Bogota,Calle 1,3,,,2024-01-15,';
      const r = parsearCSV(csv);

      expect(r.filas).toEqual([]);
      expect(r.errores).toHaveLength(1);
      expect(r.errores[0]?.linea).toBe(1);
      expect(r.errores[0]?.mensaje).toMatch(/header/i);
    });

    it('T-CSV-3 rechaza CSV sin columna municipio en el header (header mismatch)', () => {
      // Header igual al NUEVO pero omitiendo `municipio` — debe ser rechazado.
      const headerInvalido =
        'nombre_apellidos,cedula,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor';
      const csv =
        headerInvalido + '\nJuan,12345678,Calle 1,3,,,2024-01-15,';
      const r = parsearCSV(csv);

      expect(r.filas).toEqual([]);
      expect(r.errores).toHaveLength(1);
      expect(r.errores[0]?.linea).toBe(1);
      expect(r.errores[0]?.mensaje).toMatch(/header/i);
    });

    it('T-CSV-4 cuando cedula o municipio vienen vacíos en la fila, se preservan como string "" (no undefined)', () => {
      // El parser NO valida semántica de cedula/municipio (cedula debe
      // matchear /^\d{6,12}$/, municipio no vacío). Esa validación la
      // hace `crearSuscriptor`. El parser SOLO preserva los strings para
      // que el importador falle con MENSAJES_ERROR_SUSCRIPTOR.* en vez
      // de con un "undefined" críptico.
      const csv =
        HEADER_NUEVO_9 +
        '\n' +
        'Juan Perez,,,Calle 1,3,,,2024-01-15,';
      const r = parsearCSV(csv);

      expect(r.errores).toEqual([]);
      expect(r.filas).toHaveLength(1);
      expect(r.filas[0]?.cedula).toBe('');
      expect(r.filas[0]?.municipio).toBe('');
      // Y NO debe haber error de parseo: la validación es de dominio,
      // no sintáctica.
    });

    it('T-CSV-5 extrae email y telefono opcionales cuando se proveen', () => {
      const csv =
        'nombre_apellidos,cedula,email,telefono,municipio,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor' +
        '\nJuan Perez,12345678,juan@example.com,3001234567,Bogotá,Calle 1,3,,,2024-01-15,';
      const r = parsearCSV(csv);

      expect(r.errores).toEqual([]);
      expect(r.filas[0]).toMatchObject({
        email: 'juan@example.com',
        telefono: '3001234567',
      });
    });

    it('T-CSV-6 omite email y telefono cuando las celdas están vacías', () => {
      const csv =
        'nombre_apellidos,cedula,email,telefono,municipio,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor' +
        '\nJuan Perez,12345678,,,Bogotá,Calle 1,3,,,2024-01-15,';
      const r = parsearCSV(csv);

      expect(r.errores).toEqual([]);
      expect(r.filas[0]).not.toHaveProperty('email');
      expect(r.filas[0]).not.toHaveProperty('telefono');
    });
  });
});
