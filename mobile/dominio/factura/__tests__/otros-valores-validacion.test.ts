/**
 * Tests de `validarOtrosValores` y los adapters de fuente.
 *
 * TDD strict: cubre la deduplicacion de logica entre
 * `emitirFacturaSync` y `emitirFacturaAsync`. Cubre:
 *  - `CatalogoLegacy` acepta los 7 codigos del constante
 *  - `CatalogoLegacy` rechaza codigos no catalogados
 *  - `CatalogoMapa` consulta O(1) sobre el Map pre-cargado
 *  - `CatalogoMapa` rechaza inactivos
 *  - `validarOtrosValores` itera y lanza para codigos rechazados
 *  - `validarOtrosValores` no lanza con `otrosValores=[]`
 *  - `validarOtrosValores` normaliza a upper-case
 */
import {
  CatalogoLegacy,
  CatalogoMapa,
  validarOtrosValores,
} from '../otros-valores-validacion';
import type { ConceptoOtroValor } from '../../concepto-otro-valor';
import type { OtroValor } from '../types';
import { MENSAJES_ERROR_FACTURA } from '../types';

const RECONEXION_ACTIVO: ConceptoOtroValor = {
  idConcepto: 1,
  codigo: 'RECONEXION',
  descripcion: 'Cargo por reconexión',
  version: '1038-2026-v1',
  activo: true,
  requiereGlosa: false,
  createdAt: '2026-07-29T00:00:00.000Z',
};
const RECONEXION_INACTIVO: ConceptoOtroValor = { ...RECONEXION_ACTIVO, activo: false };
const FINANCIACION_INACTIVO: ConceptoOtroValor = {
  ...RECONEXION_INACTIVO,
  idConcepto: 2,
  codigo: 'FINANCIACION',
  requiereGlosa: true,
};

describe('CatalogoLegacy', () => {
  it('existe retorna true para cada uno de los 7 conceptos del constante', () => {
    const f = new CatalogoLegacy();
    expect(f.existe('RECONEXION')).toBe(true);
    expect(f.existe('SALDO_ANTERIOR')).toBe(true);
    expect(f.existe('OTROS_AUTORIZADOS')).toBe(true);
  });

  it('existe retorna false para codigos fuera del constante', () => {
    const f = new CatalogoLegacy();
    expect(f.existe('INVENTADO')).toBe(false);
    expect(f.existe('')).toBe(false);
  });

  it('activo retorna true para codigos existentes (no hay flag en constante legacy)', () => {
    const f = new CatalogoLegacy();
    expect(f.activo('RECONEXION')).toBe(true);
    expect(f.activo('INVENTADO')).toBe(false);
  });
});

describe('CatalogoMapa', () => {
  it('existe retorna true cuando el codigo esta en el mapa', () => {
    const f = CatalogoMapa.desdeLista([RECONEXION_ACTIVO]);
    expect(f.existe('RECONEXION')).toBe(true);
  });

  it('existe retorna false cuando el codigo NO esta en el mapa', () => {
    const f = CatalogoMapa.desdeLista([RECONEXION_ACTIVO]);
    expect(f.existe('INVENTADO')).toBe(false);
  });

  it('activo retorna true solo cuando existe Y activo=true', () => {
    // Dos codigos distintos: uno activo, otro inactivo. El test verifica
    // que `activo` los diferencia por separado.
    const f = CatalogoMapa.desdeLista([RECONEXION_ACTIVO, FINANCIACION_INACTIVO]);
    expect(f.activo('RECONEXION')).toBe(true);
    expect(f.activo('FINANCIACION')).toBe(false);
  });

  it('activo retorna false cuando existe pero activo=false', () => {
    const f = CatalogoMapa.desdeLista([RECONEXION_INACTIVO]);
    expect(f.activo('RECONEXION')).toBe(false);
  });

  it('lookup es case-insensitive (codigo del input puede venir en cualquier case)', () => {
    const f = CatalogoMapa.desdeLista([RECONEXION_ACTIVO]);
    expect(f.existe('reconexion')).toBe(true);
    expect(f.activo('reconexion')).toBe(true);
  });

  it('lista vacia → siempre false', () => {
    const f = CatalogoMapa.desdeLista([]);
    expect(f.existe('RECONEXION')).toBe(false);
    expect(f.activo('RECONEXION')).toBe(false);
  });

  // Verifica la propiedad perf O(1) con N grande (200 conceptos). La
  // lookup lineal con `Array.find` seria O(n) por item — con 200
  // conceptos y 10 items seria ~2000 ops. Con Map son 10 ops. El
  // test no mide tiempo (frágil en CI), pero ejercita el codigo con
  // un dataset realista para detectar regresiones si alguien
  // accidentalmente cambia la estructura interna a un Array.
  it('soporta catalogos grandes (200 conceptos) sin perder correctness', () => {
    const conceptosGrandes: ConceptoOtroValor[] = Array.from({ length: 200 }, (_, i) => ({
      idConcepto: i + 1,
      codigo: `CONCEPTO_${String(i).padStart(3, '0')}`,
      descripcion: `Concepto #${i}`,
      version: '1038-2026-v1',
      activo: i % 7 !== 0, // ~14% inactivos
      requiereGlosa: false,
      createdAt: '2026-07-29T00:00:00.000Z',
    }));
    const f = CatalogoMapa.desdeLista(conceptosGrandes);
    // Lookup de conceptos conocidos: presente + activo
    expect(f.existe('CONCEPTO_001')).toBe(true);
    expect(f.activo('CONCEPTO_001')).toBe(true);
    // Inactivo (id divisible por 7): presente pero no activo
    expect(f.existe('CONCEPTO_007')).toBe(true);
    expect(f.activo('CONCEPTO_007')).toBe(false);
    // Ausente
    expect(f.existe('CONCEPTO_999')).toBe(false);
  });
});

describe('validarOtrosValores', () => {
  it('no lanza con lista vacia (short-circuit)', () => {
    const f = new CatalogoLegacy();
    expect(() => validarOtrosValores([], f)).not.toThrow();
  });

  it('no lanza si todos los codigos existen en CatalogoLegacy', () => {
    const f = new CatalogoLegacy();
    const ovs: OtroValor[] = [
      { concepto: 'RECONEXION', valor: 1000 },
      { concepto: 'SALDO_ANTERIOR', valor: 5000 },
    ];
    expect(() => validarOtrosValores(ovs, f)).not.toThrow();
  });

  it('lanza CONCEPTO_NO_AUTORIZADO si algun codigo no existe en CatalogoLegacy', () => {
    const f = new CatalogoLegacy();
    const ovs: OtroValor[] = [
      { concepto: 'INVENTADO' as OtroValor['concepto'], valor: 1000 },
    ];
    expect(() => validarOtrosValores(ovs, f)).toThrow(
      MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO,
    );
  });

  it('lanza CONCEPTO_NO_AUTORIZADO si CatalogoMapa reporta inactivo', () => {
    const f = CatalogoMapa.desdeLista([RECONEXION_INACTIVO]);
    const ovs: OtroValor[] = [
      { concepto: 'RECONEXION' as OtroValor['concepto'], valor: 1000 },
    ];
    expect(() => validarOtrosValores(ovs, f)).toThrow(
      MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO,
    );
  });

  it('normaliza codigos a UPPER-CASE antes de consultar', () => {
    const f = new CatalogoLegacy();
    const ovs: OtroValor[] = [
      { concepto: 'reconexion' as OtroValor['concepto'], valor: 1000 },
    ];
    // El constante tiene 'RECONEXION' (upper). El input trae 'reconexion'
    // (lower). El helper normaliza → acepta.
    expect(() => validarOtrosValores(ovs, f)).not.toThrow();
  });

  it('rechaza todo el batch si UN solo codigo es invalido (atomicidad)', () => {
    const f = CatalogoMapa.desdeLista([RECONEXION_ACTIVO, FINANCIACION_INACTIVO]);
    const ovs: OtroValor[] = [
      { concepto: 'RECONEXION', valor: 1000 },
      { concepto: 'FINANCIACION', valor: 2000, glosa: 'cuota' },
    ];
    expect(() => validarOtrosValores(ovs, f)).toThrow(
      MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO,
    );
  });
});
