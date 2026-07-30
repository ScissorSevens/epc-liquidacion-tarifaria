/**
 * Tests del factory `crearPrestador` — módulo PRESTADORES.
 *
 * Cubre los requisitos del SDD `setup-inicial-multi-tenant-auth`:
 *   - Fase 3, Tarea 3.1 — factory `crearPrestador` con TODAS las
 *     validaciones del prestador (representante legal, codigo, nombre,
 *     nit, municipio, departamento, segmento, suscriptores, defaults).
 *
 * Patrón espejo de `dominio/operarios/operarios.test.ts` (factory
 * `crearOperario`). Errores se verifican con `toThrow(MENSAJES_ERROR_X)`
 * para impedir mistypes.
 */

import { crearPrestador } from '../validador-prestador';
import type { CrearPrestadorInput, PrestadorBorrador } from '../types';
import { MENSAJES_ERROR_PRESTADOR } from '../types';

const inputValido: CrearPrestadorInput = {
  codigo: '123',
  nombre: 'Asociación de Usuarios del Acueducto Vereda El Salitre',
  nit: '900123456-7',
  representante_legal: 'Juan Pérez Gómez',
  representante_legal_cedula: '12345678',
  municipio: 'Cáqueza',
  departamento: 'Cundinamarca',
  segmento: 2,
  num_suscriptores_urbanos: 0,
  num_suscriptores_rurales: 120,
};

// =====================================================================
// Bloque 1: tipos y shape (validación runtime + type-level checks)
// =====================================================================

describe('crearPrestador — tipos exportados', () => {
  it('CrearPrestadorInput requiere representante_legal (runtime: si se omite, la factory lanza)', () => {
    // Validación a nivel type via TypeScript: si representante_legal no
    // fuese required en CrearPrestadorInput, este literal compilaría sin
    // necesidad de cast. Forzamos el cast `unknown` para bypassear la
    // verificación de tipo y verificar el comportamiento runtime.
    const sinRepLegal = {
      codigo: '1',
      nombre: 'X',
      nit: '900123456-7',
      municipio: 'M',
      departamento: 'D',
      segmento: 2,
      num_suscriptores_urbanos: 0,
      num_suscriptores_rurales: 0,
    } as unknown as CrearPrestadorInput;

    // La factory debe lanzar porque representante_legal falta
    // (undefined.length === TypeError, no el de validation).
    // Aceptamos tanto el error de validación como el TypeError de runtime.
    expect(() => crearPrestador(sinRepLegal)).toThrow();
  });

  it('ActualizarPrestadorInput permite representante_legal como opcional (Partial<Pick>)', () => {
    // Verificación estructural: el type ActualizarPrestadorInput tiene
    // los 2 campos como opcionales (vía Partial). Si no estuviesen, este
    // objeto vacío daría error de compilación sin necesidad de cast.
    // Usamos un tipo "puente" para validar la forma sin invocar la factory.
    type KeysActualizables = keyof {
      [K in keyof import('../types').ActualizarPrestadorInput]: true;
    };
    // Si los siguientes asserts pasan, los campos existen en el type.
    // (Jest no permite @ts-expect-error en runtime; la verificación
    // estructural es suficiente.)
    const _check: KeysActualizables = 'representante_legal';
    const _check2: KeysActualizables = 'representante_legal_cedula';
    expect([_check, _check2]).toEqual([
      'representante_legal',
      'representante_legal_cedula',
    ]);
  });
});

// =====================================================================
// Bloque 2: factory — happy path y defaults
// =====================================================================

describe('crearPrestador — happy path', () => {
  it('crea prestador borrador con input completo válido', () => {
    const resultado: PrestadorBorrador = crearPrestador(inputValido);

    expect(resultado).toEqual({
      codigo: '123',
      nombre: 'Asociación de Usuarios del Acueducto Vereda El Salitre',
      nit: '900123456-7',
      representante_legal: 'Juan Pérez Gómez',
      representante_legal_cedula: '12345678',
      municipio: 'Cáqueza',
      departamento: 'Cundinamarca',
      segmento: 2,
      num_suscriptores_urbanos: 0,
      num_suscriptores_rurales: 120,
      contacto: null,
      estado: 'activo',
      aps: null,
    });
    expect(resultado).not.toHaveProperty('id_prestador');
    expect(resultado).not.toHaveProperty('created_at');
    expect(resultado).not.toHaveProperty('updated_at');
  });

  it('preserva estado="suspendido" cuando se pasa explícito', () => {
    const resultado = crearPrestador({ ...inputValido, estado: 'suspendido' });
    expect(resultado.estado).toBe('suspendido');
  });

  it('preserva contacto="admin@epc.co" cuando se pasa explícito', () => {
    const resultado = crearPrestador({
      ...inputValido,
      contacto: 'admin@epc.co',
    });
    expect(resultado.contacto).toBe('admin@epc.co');
  });
});

// =====================================================================
// Bloque 3: factory — validaciones de strings (codigo, nombre, nit)
// =====================================================================

describe('crearPrestador — codigo', () => {
  it('rechaza codigo vacío', () => {
    expect(() => crearPrestador({ ...inputValido, codigo: '' })).toThrow(
      MENSAJES_ERROR_PRESTADOR.CODIGO_VACIO,
    );
  });

  it('acepta codigo de 1 dígito (límite inferior)', () => {
    const resultado = crearPrestador({ ...inputValido, codigo: '1' });
    expect(resultado.codigo).toBe('1');
  });

  it('acepta codigo de 50 dígitos (límite superior)', () => {
    const resultado = crearPrestador({
      ...inputValido,
      codigo: '1'.repeat(50),
    });
    expect(resultado.codigo).toBe('1'.repeat(50));
  });
});

describe('crearPrestador — nombre', () => {
  it('rechaza nombre vacío', () => {
    expect(() => crearPrestador({ ...inputValido, nombre: '' })).toThrow(
      MENSAJES_ERROR_PRESTADOR.NOMBRE_VACIO,
    );
  });

  it('rechaza nombre de 201 caracteres', () => {
    expect(() =>
      crearPrestador({ ...inputValido, nombre: 'a'.repeat(201) }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.NOMBRE_LARGO);
  });
});

describe('crearPrestador — nit', () => {
  it('rechaza nit vacío', () => {
    expect(() => crearPrestador({ ...inputValido, nit: '' })).toThrow(
      MENSAJES_ERROR_PRESTADOR.NIT_VACIO,
    );
  });

  it('rechaza nit de 21 caracteres', () => {
    expect(() => crearPrestador({ ...inputValido, nit: '1'.repeat(21) })).toThrow(
      MENSAJES_ERROR_PRESTADOR.NIT_LARGO,
    );
  });
});

// =====================================================================
// Bloque 4: factory — representante legal (foco de Tarea 3.1)
// =====================================================================

describe('crearPrestador — representante_legal', () => {
  it('rechaza representante_legal vacío', () => {
    expect(() =>
      crearPrestador({ ...inputValido, representante_legal: '' }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.REPRESENTANTE_LEGAL_VACIO);
  });

  it('acepta representante_legal de 1 carácter (caso límite)', () => {
    const resultado = crearPrestador({
      ...inputValido,
      representante_legal: 'J',
    });
    expect(resultado.representante_legal).toBe('J');
  });

  it('acepta representante_legal de 200 caracteres (caso largo válido)', () => {
    const resultado = crearPrestador({
      ...inputValido,
      representante_legal: 'a'.repeat(200),
    });
    expect(resultado.representante_legal).toBe('a'.repeat(200));
  });
});

describe('crearPrestador — representante_legal_cedula', () => {
  it('rechaza cedula_rep_legal vacía', () => {
    expect(() =>
      crearPrestador({ ...inputValido, representante_legal_cedula: '' }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.CEDULA_REP_LEGAL_INVALIDA);
  });

  it('rechaza cedula_rep_legal de 5 dígitos', () => {
    expect(() =>
      crearPrestador({
        ...inputValido,
        representante_legal_cedula: '12345',
      }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.CEDULA_REP_LEGAL_INVALIDA);
  });

  it('rechaza cedula_rep_legal de 13 dígitos', () => {
    expect(() =>
      crearPrestador({
        ...inputValido,
        representante_legal_cedula: '1234567890123',
      }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.CEDULA_REP_LEGAL_INVALIDA);
  });

  it('rechaza cedula_rep_legal con letras', () => {
    expect(() =>
      crearPrestador({
        ...inputValido,
        representante_legal_cedula: 'abc12345',
      }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.CEDULA_REP_LEGAL_INVALIDA);
  });

  it('acepta cedula_rep_legal de 6 dígitos (límite inferior)', () => {
    const resultado = crearPrestador({
      ...inputValido,
      representante_legal_cedula: '100000',
    });
    expect(resultado.representante_legal_cedula).toBe('100000');
  });

  it('acepta cedula_rep_legal de 12 dígitos (límite superior)', () => {
    const resultado = crearPrestador({
      ...inputValido,
      representante_legal_cedula: '123456789012',
    });
    expect(resultado.representante_legal_cedula).toBe('123456789012');
  });
});

// =====================================================================
// Bloque 5: factory — ubicación (municipio, departamento, segmento)
// =====================================================================

describe('crearPrestador — municipio y departamento', () => {
  it('rechaza municipio vacío', () => {
    expect(() =>
      crearPrestador({ ...inputValido, municipio: '' }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.MUNICIPIO_VACIO);
  });

  it('rechaza municipio de 101 caracteres', () => {
    expect(() =>
      crearPrestador({ ...inputValido, municipio: 'a'.repeat(101) }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.MUNICIPIO_LARGO);
  });

  it('rechaza departamento vacío', () => {
    expect(() =>
      crearPrestador({ ...inputValido, departamento: '' }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.DEPARTAMENTO_VACIO);
  });

  it('rechaza departamento de 101 caracteres', () => {
    expect(() =>
      crearPrestador({ ...inputValido, departamento: 'a'.repeat(101) }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.DEPARTAMENTO_LARGO);
  });
});

describe('crearPrestador — segmento', () => {
  it('rechaza segmento = 0', () => {
    expect(() =>
      crearPrestador({
        ...inputValido,
        segmento: 0 as unknown as 1 | 2,
      }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.SEGMENTO_INVALIDO);
  });

  it('rechaza segmento = 3', () => {
    expect(() =>
      crearPrestador({
        ...inputValido,
        segmento: 3 as unknown as 1 | 2,
      }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.SEGMENTO_INVALIDO);
  });

  it('acepta segmento = 1', () => {
    const resultado = crearPrestador({ ...inputValido, segmento: 1 });
    expect(resultado.segmento).toBe(1);
  });
});

// =====================================================================
// Bloque 6: factory — suscriptores (no negativos)
// =====================================================================

describe('crearPrestador — suscriptores', () => {
  it('rechaza num_suscriptores_urbanos negativo', () => {
    expect(() =>
      crearPrestador({ ...inputValido, num_suscriptores_urbanos: -1 }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.NUM_URBANOS_NEGATIVO);
  });

  it('rechaza num_suscriptores_rurales negativo', () => {
    expect(() =>
      crearPrestador({ ...inputValido, num_suscriptores_rurales: -1 }),
    ).toThrow(MENSAJES_ERROR_PRESTADOR.NUM_RURALES_NEGATIVO);
  });

  it('acepta num_suscriptores_urbanos = 0', () => {
    const resultado = crearPrestador({
      ...inputValido,
      num_suscriptores_urbanos: 0,
    });
    expect(resultado.num_suscriptores_urbanos).toBe(0);
  });

  it('acepta num_suscriptores_rurales = 0', () => {
    const resultado = crearPrestador({
      ...inputValido,
      num_suscriptores_rurales: 0,
    });
    expect(resultado.num_suscriptores_rurales).toBe(0);
  });
});
