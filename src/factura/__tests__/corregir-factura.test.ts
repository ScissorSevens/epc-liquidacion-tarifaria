/**
 * Tests del orquestador puro `corregirFactura`.
 *
 * `corregirFactura` es una función pura (design D2): no invoca
 * `emitirFactura` ni `anularFactura` internamente, no toca repos, no
 * importa el módulo `calculo`. Recibe la facturaOriginal + el par
 * { liquidacionAnulada, liquidacionNueva } ya producido por el caller
 * (típicamente vía `calculo.anularYReemplazar`) y arma:
 *   - facturaAnulada: clon de facturaOriginal con estado ANULADA + motivo + fecha
 *   - nuevoBorrador: clon del snapshot de facturaOriginal reemplazando solo
 *     liquidacion = liquidacionNueva, numero_factura = consecutivoNuevo,
 *     fecha_emision = fechaEmision, estado = 'BORRADOR'
 *
 * NO re-emite (no reconstruye aggregates fakeados) — reusa el snapshot
 * ya validado de la factura original.
 */

import { corregirFactura, emitirFactura, calcularHashFactura } from '../factura';
import { MENSAJES_ERROR_FACTURA, type EmitirFacturaInput, type Factura } from '../types';
import { calcularHash } from '../../calculo/calculo';
import type { Liquidacion } from '../../calculo/types';
import type { Suscriptor } from '../../suscriptores/types';
import type { Medidor } from '../../medidores/types';
import type { Periodo } from '../../periodos/types';
import type { Operario } from '../../operarios/types';
import type { ResultadoCalculo } from '../../motor-tarifario';

function suscriptorBase(): Suscriptor {
  return {
    id_suscriptor: 1,
    codigo: '00001',
    nombre_apellidos: 'María López',
    direccion: 'Calle 5 #2-10',
    estrato: 2,
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function medidorBase(): Medidor {
  return {
    id_medidor: 10,
    numero_medidor: 'MED-0001',
    id_suscriptor: 1,
    fecha_instalacion: '2024-01-15',
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function periodoBase(): Periodo {
  return {
    id_periodo: '202601',
    nombre: 'Enero 2026',
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-01-31',
    fecha_pago_sin_recargo: '2026-02-15',
    fecha_pago_con_recargo: '2026-02-28',
    dias_consumo: 31,
    estado: 'cerrado',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function operarioBase(): Operario {
  return {
    id_operario: 7,
    numero_cedula: '1234567890',
    nombre: 'Ana Gómez',
    email: 'ana@epc.co',
    password_hash: 'argon2id$v=19$m=...',
    rol: 'operario',
    estado: 'activo',
    dispositivo_id: 'MZ-001',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function resultadoBase(): ResultadoCalculo {
  return {
    consumo: 12,
    consumoBasico: 12,
    consumoExcedente: 0,
    cargoFijo: 5000,
    cargoConsumo: 18000,
    cargoExcedente: 0,
    subsidio: 4600,
    contribucion: 0,
    total: 18400,
  };
}

/** Liquidacion con id explícito y resultado configurable. */
function liquidacionConId(id: string, resultado: ResultadoCalculo = resultadoBase()): Liquidacion {
  const base = {
    id,
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
    resultado,
    estado: 'ACTIVA' as const,
  };
  return { ...base, hash: calcularHash(base) };
}

function inputBaseConLiquidacion(liquidacion: Liquidacion): EmitirFacturaInput {
  return {
    suscriptor: suscriptorBase(),
    medidor: medidorBase(),
    periodo: periodoBase(),
    operario: operarioBase(),
    liquidacion,
    consumosHistoricos: [],
    fechaEmision: '2026-02-01',
    consecutivo: 1,
  };
}

/** Factura "ya emitida" (BORRADOR forzado a EMITIDA, mismo patrón que factura.test.ts). */
function facturaOriginalConLiquidacion(liquidacion: Liquidacion): Factura {
  const borrador = emitirFactura(inputBaseConLiquidacion(liquidacion));
  return Object.freeze({ ...borrador, estado: 'EMITIDA' as const });
}

describe('corregirFactura — orquestador puro', () => {
  it('retorna objeto con llaves facturaAnulada y nuevoBorrador', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);

    const resultado = corregirFactura({
      facturaOriginal,
      liquidacionAnulada: { ...liqOriginal, estado: 'ANULADA' },
      liquidacionNueva: liqNueva,
      consecutivoNuevo: 2,
      fechaEmision: '2026-02-15',
    });

    expect(resultado).toHaveProperty('facturaAnulada');
    expect(resultado).toHaveProperty('nuevoBorrador');
  });

  it('retorna facturaAnulada y nuevoBorrador deepFrozen', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);

    const { facturaAnulada, nuevoBorrador } = corregirFactura({
      facturaOriginal,
      liquidacionAnulada: { ...liqOriginal, estado: 'ANULADA' },
      liquidacionNueva: liqNueva,
      consecutivoNuevo: 2,
      fechaEmision: '2026-02-15',
    });

    expect(Object.isFrozen(facturaAnulada)).toBe(true);
    expect(Object.isFrozen(facturaAnulada.snapshot)).toBe(true);
    expect(Object.isFrozen(nuevoBorrador)).toBe(true);
    expect(Object.isFrozen(nuevoBorrador.snapshot)).toBe(true);
    // ambos deben ser objetos distintos (no el mismo facturaOriginal devuelto dos veces)
    expect(facturaAnulada).not.toBe(nuevoBorrador);
  });

  it('facturaAnulada conserva el numero_factura original (no usa el consecutivoNuevo)', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);
    const numeroOriginal = facturaOriginal.numero_factura; // 'MZ-001-1'

    const { facturaAnulada } = corregirFactura({
      facturaOriginal,
      liquidacionAnulada: { ...liqOriginal, estado: 'ANULADA' },
      liquidacionNueva: liqNueva,
      consecutivoNuevo: 99,
      fechaEmision: '2026-02-15',
    });

    expect(facturaAnulada.numero_factura).toBe(numeroOriginal);
    expect(facturaAnulada.estado).toBe('ANULADA');
  });

  it('nuevoBorrador.snapshot.liquidacion.id apunta a la liquidacionNueva (no a la anulada)', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);

    const { nuevoBorrador } = corregirFactura({
      facturaOriginal,
      liquidacionAnulada: { ...liqOriginal, estado: 'ANULADA' },
      liquidacionNueva: liqNueva,
      consecutivoNuevo: 2,
      fechaEmision: '2026-02-15',
    });

    expect(nuevoBorrador.snapshot.liquidacion.id).toBe(liqNueva.id);
    expect(nuevoBorrador.snapshot.liquidacion.hash).toBe(liqNueva.hash);
    expect(nuevoBorrador.estado).toBe('BORRADOR');
    // resto del snapshot proviene de facturaOriginal — NO se reemite
    expect(nuevoBorrador.snapshot.suscriptor).toEqual(facturaOriginal.snapshot.suscriptor);
    expect(nuevoBorrador.snapshot.periodo).toEqual(facturaOriginal.snapshot.periodo);
  });

  it('nuevoBorrador.numero_factura refleja el consecutivoNuevo (no copia el original)', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);
    const numeroOriginal = facturaOriginal.numero_factura;

    const { nuevoBorrador } = corregirFactura({
      facturaOriginal,
      liquidacionAnulada: { ...liqOriginal, estado: 'ANULADA' },
      liquidacionNueva: liqNueva,
      consecutivoNuevo: 42,
      fechaEmision: '2026-02-15',
    });

    expect(nuevoBorrador.numero_factura).toContain('42');
    expect(nuevoBorrador.numero_factura).not.toBe(numeroOriginal);
  });

  it('lanza CORRECCION_LIQUIDACION_ANULADA_NO_COINCIDE cuando liquidacionAnulada.id no es la de facturaOriginal', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqOtra = liquidacionConId('cccccccc-cccc-cccc-cccc-cccccccccccc'); // mismatch
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);

    expect(() =>
      corregirFactura({
        facturaOriginal,
        liquidacionAnulada: { ...liqOtra, estado: 'ANULADA' },
        liquidacionNueva: liqNueva,
        consecutivoNuevo: 2,
        fechaEmision: '2026-02-15',
      }),
    ).toThrow(MENSAJES_ERROR_FACTURA.CORRECCION_LIQUIDACION_ANULADA_NO_COINCIDE);
  });

  it('el nuevoBorrador tiene hash recalculado coherente con su snapshot modificado', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);

    const { nuevoBorrador } = corregirFactura({
      facturaOriginal,
      liquidacionAnulada: { ...liqOriginal, estado: 'ANULADA' },
      liquidacionNueva: liqNueva,
      consecutivoNuevo: 42,
      fechaEmision: '2026-02-15',
    });

    const hashEsperado = calcularHashFactura(
      nuevoBorrador.snapshot,
      nuevoBorrador.numero_factura,
      nuevoBorrador.fecha_emision,
    );
    expect(nuevoBorrador.hash).toBe(hashEsperado);
    // y NO debe ser el hash del original (snapshot cambió)
    expect(nuevoBorrador.hash).not.toBe(facturaOriginal.hash);
  });

  it('la facturaAnulada conserva el hash original (su snapshot no cambia)', () => {
    const liqOriginal = liquidacionConId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const liqNueva = liquidacionConId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const facturaOriginal = facturaOriginalConLiquidacion(liqOriginal);

    const { facturaAnulada } = corregirFactura({
      facturaOriginal,
      liquidacionAnulada: { ...liqOriginal, estado: 'ANULADA' },
      liquidacionNueva: liqNueva,
      consecutivoNuevo: 2,
      fechaEmision: '2026-02-15',
    });

    // Anulación es metadata fuera del snapshot — hash del snapshot no cambia.
    expect(facturaAnulada.hash).toBe(facturaOriginal.hash);
  });
});
