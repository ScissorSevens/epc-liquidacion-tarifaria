/**
 * Tests de la factory `crearConceptoOtroValor` y los errores de
 * dominio del modulo `concepto-otro-valor`.
 *
 * TDD strict: cubre el contrato de la factory (input valido → output
 * congelado con placeholders) y los errores de dominio con sus
 * discriminadores (`name`, `codigo`).
 */
import {
  crearConceptoOtroValor,
  type CrearConceptoOtroValorInput,
  ConceptoOtroValorNoEncontradoError,
  ConceptoOtroValorInactivoError,
} from '../';

describe('crearConceptoOtroValor — factory pura', () => {
  it('acepta un input valido y retorna el ConceptoOtroValor', () => {
    const input: CrearConceptoOtroValorInput = {
      codigo: 'RECONEXION',
      descripcion: 'Cargo por reconexión del servicio',
      activo: true,
      requiereGlosa: false,
    };
    const c = crearConceptoOtroValor(input);
    expect(c.codigo).toBe('RECONEXION');
    expect(c.descripcion).toBe('Cargo por reconexión del servicio');
    expect(c.activo).toBe(true);
    expect(c.requiereGlosa).toBe(false);
  });

  it('asigna version por default si no se provee', () => {
    const c = crearConceptoOtroValor({
      codigo: 'RECONEXION',
      descripcion: 'X',
      activo: true,
      requiereGlosa: false,
    });
    // CATALOGO_VERSION_INICIAL = '1038-2026-v1'
    expect(c.version).toBe('1038-2026-v1');
  });

  it('respeta version custom si se provee', () => {
    const c = crearConceptoOtroValor({
      codigo: 'RECONEXION',
      descripcion: 'X',
      version: '1038-2026-v2',
      activo: true,
      requiereGlosa: false,
    });
    expect(c.version).toBe('1038-2026-v2');
  });

  it('idConcepto y createdAt son placeholders (los asigna el adapter SQLite)', () => {
    const c = crearConceptoOtroValor({
      codigo: 'RECONEXION',
      descripcion: 'X',
      activo: true,
      requiereGlosa: false,
    });
    expect(c.idConcepto).toBe(0);
    expect(c.createdAt).toBe('');
  });

  it('lanza error si codigo no esta en la lista regulatoria', () => {
    expect(() =>
      crearConceptoOtroValor({
        codigo: 'INVENTADO' as never,
        descripcion: 'X',
        activo: true,
        requiereGlosa: false,
      }),
    ).toThrow(/codigo.*no esta en la lista regulatoria/i);
  });

  it('lanza error si descripcion es vacia', () => {
    expect(() =>
      crearConceptoOtroValor({
        codigo: 'RECONEXION',
        descripcion: '',
        activo: true,
        requiereGlosa: false,
      }),
    ).toThrow(/descripcion.*requerida/i);
  });

  it('lanza error si version es vacia cuando se provee explicitamente', () => {
    expect(() =>
      crearConceptoOtroValor({
        codigo: 'RECONEXION',
        descripcion: 'X',
        version: '',
        activo: true,
        requiereGlosa: false,
      }),
    ).toThrow(/version.*no puede ser vacia/i);
  });

  it('el ConceptoOtroValor retornado es deepFrozen', () => {
    const c = crearConceptoOtroValor({
      codigo: 'RECONEXION',
      descripcion: 'X',
      activo: true,
      requiereGlosa: false,
    });
    expect(Object.isFrozen(c)).toBe(true);
  });
});

describe('ConceptoOtroValorNoEncontradoError', () => {
  it('expone el codigo buscado en .codigo', () => {
    const err = new ConceptoOtroValorNoEncontradoError('INVENTADO');
    expect(err.codigo).toBe('INVENTADO');
    expect(err.name).toBe('ConceptoOtroValorNoEncontradoError');
    expect(err.message).toMatch(/INVENTADO/);
  });

  it('acepta mensaje custom', () => {
    const err = new ConceptoOtroValorNoEncontradoError('INVENTADO', 'custom msg');
    expect(err.message).toBe('custom msg');
  });

  it('es instanceof Error', () => {
    const err = new ConceptoOtroValorNoEncontradoError('X');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConceptoOtroValorNoEncontradoError);
  });
});

describe('ConceptoOtroValorInactivoError', () => {
  it('expone el codigo inactivo en .codigo', () => {
    const err = new ConceptoOtroValorInactivoError('RECONEXION');
    expect(err.codigo).toBe('RECONEXION');
    expect(err.name).toBe('ConceptoOtroValorInactivoError');
    expect(err.message).toMatch(/RECONEXION/);
  });

  it('acepta mensaje custom', () => {
    const err = new ConceptoOtroValorInactivoError('RECONEXION', 'custom');
    expect(err.message).toBe('custom');
  });

  it('es instanceof Error', () => {
    const err = new ConceptoOtroValorInactivoError('X');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConceptoOtroValorInactivoError);
  });
});
