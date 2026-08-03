/**
 * Tests del serializer puro `armarTicketEscPos`.
 *
 * Cubre los escenarios del spec `factura-impresion-termica` REQ 2-5:
 *  - 58mm y 80mm con anchos maximos exactos (32 y 42 cols)
 *  - Determinismo (mismo input -> mismo output)
 *  - Codigo de verificacion como texto legible
 *  - Referencia de pago destacada
 *  - Wrap por palabras (nombre largo del suscriptor)
 *  - Char-break con dash para palabras unitariamente largas
 *  - Sin QR visual ni binarios
 *  - Factura sin otros_valores ni saldo_anterior no rompe
 *  - Render completo de todas las secciones normativas
 *
 * Cada it() mapea a un Then del spec. RED phase: estos tests fallan
 * porque `dominio/impresion/esc-pos.ts` aun no existe.
 */

import type { Factura } from '../factura/types';
import {
  armarTicketEscPos,
  envolverLinea,
  centrarLinea,
  padRight,
  normalizarParaImpresora,
  formatearFechaCorta,
  formatearMontoCorto,
  ANCHO_POR_PAPEL,
} from '../esc-pos';

// ── Fixture builder ──────────────────────────────────────────────────────────

interface CrearFacturaEjemploOverrides {
  readonly codigo_verificacion?: string;
  readonly referencia_pago?: string;
  readonly fecha_emision?: string;
  readonly numero_factura?: string;
  readonly hash?: string;
  readonly suscriptor_nombre?: string;
  readonly otros_valores?: readonly { concepto: string; valor: number }[];
  readonly saldo_anterior?: number;
}

function crearFacturaEjemplo(
  overrides: CrearFacturaEjemploOverrides = {},
): Factura {
  const codigoVerificacion = overrides.codigo_verificacion ?? 'ABC123XYZ0';
  const referenciaPago = overrides.referencia_pago ?? '1-202601-99-A1B2';
  const fechaEmision = overrides.fecha_emision ?? '2026-02-01';
  const numeroFactura = overrides.numero_factura ?? 'MZ-001-1';
  const hash = overrides.hash ?? 'hash-fijo-test-0001';
  const suscriptorNombre =
    overrides.suscriptor_nombre ?? 'Maria Lopez Garcia';
  const otrosValores = overrides.otros_valores ?? [];
  const saldoAnterior = overrides.saldo_anterior ?? 0;

  return Object.freeze({
    id: 'factura-fija-test-id',
    numero_factura: numeroFactura,
    estado: 'EMITIDA' as const,
    fecha_emision: fechaEmision,
    snapshot: Object.freeze({
      suscriptor: Object.freeze({
        codigo: '00001',
        nombre_apellidos: suscriptorNombre,
        cedula: '123456789',
        email: null,
        telefono: null,
        municipio: 'Bogota',
        sector: null,
        calle: null,
        direccion: 'Calle 5 #2-10',
        estrato: 2 as const,
        estado: 'activo' as const,
        matricula_inmobiliaria: null,
        numero_catastral: null,
        id_prestador: 1,
        categoria_uso: 'residencial' as const,
      }),
      medidor: Object.freeze({
        id_medidor: 10,
        numero_medidor: 'MED-0001',
        estado: 'activo' as const,
        fecha_instalacion: '2024-01-15',
      }),
      periodo: Object.freeze({
        id_periodo: '202601',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-01-31',
        fecha_pago_sin_recargo: '2026-02-15',
        fecha_pago_con_recargo: '2026-02-28',
        dias_consumo: 31,
      }),
      operario: Object.freeze({
        id_operario: 7,
        id_prestador: 1,
        numero_cedula: '1234567890',
        nombre: 'Ana Gomez',
        email: 'ana@epc.co',
        rol: 'operario' as const,
        estado: 'activo' as const,
        dispositivo_id: 'MZ-001',
      }),
      prestador: Object.freeze({
        id_prestador: 1,
        codigo: '0001',
        nombre: 'Aguas del Valle S.A. E.S.P.',
        nit: '900123456-7',
        municipio: 'Cali',
        departamento: 'Valle del Cauca',
        representante_legal: 'Carlos Ramirez',
        representante_legal_cedula: '79123456',
      }),
      lectura: Object.freeze({
        lectura_actual: 1234,
        lectura_anterior: 1200,
        estado_validacion: 'validado' as const,
        evidencia_foto_path: null,
        evidencia_foto_hash: null,
        timestamp_captura: '2026-02-01T08:30:00.000Z',
        observaciones: null,
      }),
      liquidacion: Object.freeze({
        id: 'liq-fija-test-id',
        hash: 'liq-hash-fijo-test',
        resultado: Object.freeze({
          id_prestador: 1,
          estrato: 2 as const,
          categoria_uso: 'residencial' as const,
          consumo_m3: 34,
          consumo_efectivo_m3: 34,
          bloques: Object.freeze([]),
          cargo_fijo: 5000,
          cc_unitario: 1500,
          cc_total: 51000,
          subsidio: 0,
          contribucion: 0,
          total: 56000,
          factor_aplicado: 0,
          metadata: Object.freeze({
            norma_aplicada: 'Res CRA 825/2017',
            acuerdo_id: null,
            parametros_id: 1,
            cmviaa_aplicado: false,
            minimo_vital_aplicado: false,
            factor_capeado: false,
            version_motor: '825-907-v1',
            calculo_timestamp: '2026-02-01T10:00:00.000Z',
          }),
        }),
      }),
      consumosHistoricos: Object.freeze([]),
      otros_valores: Object.freeze(otrosValores),
      saldo_anterior: saldoAnterior,
      metadata: Object.freeze({ hash_version: 'v2' as const }),
    }),
    hash,
    codigo_verificacion: codigoVerificacion,
    version_tarifa_aplicada: '825-907-v1',
    referencia_pago: referenciaPago,
    qr_pago: 'qr-fixture',
    created_at: '2026-02-01T10:00:00.000Z',
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('armarTicketEscPos — ancho de papel', () => {
  it('retorna lineas de maximo 32 chars para 58mm', () => {
    const factura = crearFacturaEjemplo();
    const lineas = armarTicketEscPos(factura, '58mm');
    expect(lineas.length).toBeGreaterThan(0);
    for (const linea of lineas) {
      expect(linea.length).toBeLessThanOrEqual(32);
    }
  });

  it('retorna lineas de maximo 42 chars para 80mm', () => {
    const factura = crearFacturaEjemplo();
    const lineas = armarTicketEscPos(factura, '80mm');
    expect(lineas.length).toBeGreaterThan(0);
    for (const linea of lineas) {
      expect(linea.length).toBeLessThanOrEqual(42);
    }
  });
});

describe('armarTicketEscPos — determinismo', () => {
  it('mismo input produce mismo output (determinista)', () => {
    const factura = crearFacturaEjemplo();
    const a = armarTicketEscPos(factura, '58mm');
    const b = armarTicketEscPos(factura, '58mm');
    expect(a).toEqual(b);
  });
});

describe('armarTicketEscPos — codigo verificacion y referencia pago', () => {
  it('incluye codigo de verificacion como texto legible', () => {
    const factura = crearFacturaEjemplo({ codigo_verificacion: 'ABC123XYZ0' });
    const ticket = armarTicketEscPos(factura, '58mm').join('\n');
    expect(ticket).toMatch(/ABC123XYZ0/);
  });

  it('incluye referencia de pago como texto destacado', () => {
    const factura = crearFacturaEjemplo({ referencia_pago: '1-202601-99-A1B2' });
    const ticket = armarTicketEscPos(factura, '58mm').join('\n');
    expect(ticket).toContain('1-202601-99-A1B2');
  });
});

describe('armarTicketEscPos — wrap de texto largo', () => {
  it('wrappea nombre largo del suscriptor en palabras', () => {
    const factura = crearFacturaEjemplo({
      suscriptor_nombre: 'Juan Perez Garcia Lopez',
    });
    const lineas = armarTicketEscPos(factura, '58mm');
    // Encuentra lineas que contengan partes del nombre (wrap puede dividir)
    const lineasNombre = lineas.filter((l) => /Perez|Garcia|Lopez|Juan/.test(l));
    expect(lineasNombre.length).toBeGreaterThanOrEqual(1);
    // Cada linea no excede 32 cols (validacion global ya cubre esto)
  });

  it('parte con dash palabras unitariamente largas', () => {
    const palabraLarga = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    expect(palabraLarga.length).toBeGreaterThan(32);
    const partes = envolverLinea(palabraLarga, 32);
    expect(partes.length).toBeGreaterThan(1);
    // Todas las lineas (menos la ultima) terminan con dash
    for (let i = 0; i < partes.length - 1; i++) {
      expect(partes[i].endsWith('-')).toBe(true);
    }
    // La ultima no necesariamente tiene dash
    const ultima = partes[partes.length - 1];
    expect(ultima.length).toBeLessThanOrEqual(32);
  });
});

describe('armarTicketEscPos — no binarios', () => {
  it('no incluye QR visual ni binarios', () => {
    const factura = crearFacturaEjemplo();
    const lineas = armarTicketEscPos(factura, '58mm');
    for (const linea of lineas) {
      expect(linea).not.toMatch(/%PDF|[\u0000-\u0008]/);
    }
  });
});

describe('armarTicketEscPos — casos degenerados', () => {
  it('factura sin otros_valores ni saldo_anterior no rompe', () => {
    const factura = crearFacturaEjemplo({
      otros_valores: [],
      saldo_anterior: 0,
    });
    expect(() => armarTicketEscPos(factura, '58mm')).not.toThrow();
    expect(() => armarTicketEscPos(factura, '80mm')).not.toThrow();
  });
});

describe('armarTicketEscPos — secciones completas', () => {
  it('renderiza secciones header / suscriptor / medidor / periodo / lectura / liquidacion / footer', () => {
    const factura = crearFacturaEjemplo();
    const ticket = armarTicketEscPos(factura, '58mm').join('\n');
    // Header: nombre del prestador
    expect(ticket).toContain('Aguas del Valle');
    // Suscriptor: nombre + cedula + direccion
    expect(ticket).toMatch(/Maria Lopez/i);
    expect(ticket).toContain('123456789');
    expect(ticket).toMatch(/Calle 5/);
    // Medidor
    expect(ticket).toContain('MED-0001');
    // Periodo
    expect(ticket).toMatch(/2026/);
    // Lectura (actual / anterior)
    expect(ticket).toMatch(/1234/);
    expect(ticket).toMatch(/1200/);
    // Liquidacion: cargo fijo
    expect(ticket).toMatch(/Cargo Fijo|CF/i);
    // Footer: codigo verificacion
    expect(ticket).toMatch(/ABC123XYZ0/);
  });
});

// ── Helpers puros ────────────────────────────────────────────────────────────

describe('envolverLinea', () => {
  it('texto corto retorna array de un elemento', () => {
    expect(envolverLinea('hola', 32)).toEqual(['hola']);
  });

  it('texto con espacios largos los parte por palabras', () => {
    const textoLargo = 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce';
    const partes = envolverLinea(textoLargo, 20);
    expect(partes.length).toBeGreaterThan(1);
    for (const p of partes) {
      expect(p.length).toBeLessThanOrEqual(20);
    }
  });
});

describe('centrarLinea', () => {
  it('centra un texto agregando padding izquierdo', () => {
    const linea = centrarLinea('Hola', 10);
    expect(linea.length).toBe(10);
    expect(linea.endsWith('Hola')).toBe(true);
  });
});

describe('padRight', () => {
  it('rellena con espacios hasta el ancho', () => {
    expect(padRight('abc', 6)).toBe('abc   ');
    expect(padRight('abc', 6).length).toBe(6);
  });

  it('texto mas ancho que el target se retorna sin recortar', () => {
    expect(padRight('abcdefghij', 5)).toBe('abcdefghij');
  });
});

describe('normalizarParaImpresora', () => {
  it('reemplaza tildes por ASCII', () => {
    expect(normalizarParaImpresora('camión')).toBe('camion');
    expect(normalizarParaImpresora('María')).toBe('Maria');
  });

  it('reemplaza eñe por n', () => {
    expect(normalizarParaImpresora('año')).toBe('ano');
  });

  it('preserva caracteres ASCII sin cambios', () => {
    expect(normalizarParaImpresora('hello world 123')).toBe('hello world 123');
  });
});

describe('formatearFechaCorta', () => {
  it('formatea ISO a DD MMM YYYY', () => {
    expect(formatearFechaCorta('2026-02-01')).toBe('01 FEB 2026');
    expect(formatearFechaCorta('2026-12-31')).toBe('31 DIC 2026');
  });
});

describe('formatearMontoCorto', () => {
  it('formatea COP sin decimales con separador de miles', () => {
    expect(formatearMontoCorto(56000)).toBe('56.000');
    expect(formatearMontoCorto(1234567)).toBe('1.234.567');
    expect(formatearMontoCorto(0)).toBe('0');
  });
});

describe('ANCHO_POR_PAPEL', () => {
  it('mapea 58mm a 32 cols', () => {
    expect(ANCHO_POR_PAPEL['58mm']).toBe(32);
  });
  it('mapea 80mm a 42 cols', () => {
    expect(ANCHO_POR_PAPEL['80mm']).toBe(42);
  });
});
