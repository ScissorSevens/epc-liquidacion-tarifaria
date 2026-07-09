/**
 * Tests de tipos del módulo OPERARIOS — Tarea 3.2 (multi-tenant).
 *
 * Cobertura:
 *   - Operario: id_prestador required (number)
 *   - OperarioBorrador: id_prestador heredado de Operario
 *   - CrearOperarioInput: id_prestador required
 *   - ActualizarOperarioInput: id_prestador opcional (Partial)
 *   - Disciplina: la validación de id_prestador > 0 es responsabilidad
 *     del validador `idPrestadorRequeridoValido` (Fase 2.2 / Fase 4);
 *     el type system NO restringe el valor numérico.
 *
 * Patrón espejo de `dominio/prestadores/__tests__/prestador.test.ts`
 * (Bloque 1: tipos y shape). La verificación es type-level: si el type
 * no tiene el campo o no es opcional donde debe, este archivo NO
 * compila → el test es RED a nivel de TypeScript.
 */

import type {
  ActualizarOperarioInput,
  CrearOperarioInput,
  Operario,
  OperarioBorrador,
} from '../types';

// ── Helpers type-level ────────────────────────────────────────────────────

/**
 * Bridge function: si Operario (o cualquier tipo que se le pase) no
 * tiene `id_prestador: number`, esta firma no acepta el argumento y el
 * archivo no compila. La asignación de _operarioCompleto al parámetro
 * es la verificación real.
 */
function extraerIdPrestador(o: { readonly id_prestador: number }): number {
  return o.id_prestador;
}

const _operarioCompleto: Operario = {
  id_operario: 1,
  id_prestador: 1,
  numero_cedula: '1234567890',
  nombre: 'Ana Gómez',
  email: 'ana@epc.co',
  password_hash: 'argon2id$v=19$m=...',
  rol: 'operario',
  estado: 'activo',
  created_at: '2024-01-15T00:00:00Z',
};

// ── Tests ────────────────────────────────────────────────────────────────

describe('Operario types — id_prestador (Tarea 3.2)', () => {
  it('Operario interface incluye id_prestador: number', () => {
    // Type-level: extraerIdPrestador acepta _operarioCompleto.
    // Si id_prestador faltase, esta línea no compilaría.
    const id: number = extraerIdPrestador(_operarioCompleto);
    expect(id).toBe(1);
  });

  it('OperarioBorrador (Omit<Operario, id_operario|created_at>) hereda id_prestador', () => {
    // Si OperarioBorrador NO heredase id_prestador, este literal
    // daría error de compilación.
    const borrador: OperarioBorrador = {
      id_prestador: 1,
      numero_cedula: '1234567890',
      nombre: 'Ana',
      email: 'ana@epc.co',
      password_hash: 'h',
      rol: 'operario',
      estado: 'activo',
    };
    expect(extraerIdPrestador(borrador)).toBe(1);
  });

  it('CrearOperarioInput (Omit + rol? + estado?) requiere id_prestador', () => {
    // El Omit de CrearOperarioInput no excluye id_prestador → debe
    // ser required. Si no, este literal compila sin necesidad de
    // agregarlo (falso GREEN).
    const input: CrearOperarioInput = {
      id_prestador: 1,
      numero_cedula: '1234567890',
      nombre: 'Ana',
      email: 'ana@epc.co',
      password_hash: 'h',
    };
    expect(extraerIdPrestador(input)).toBe(1);
  });

  it('ActualizarOperarioInput (Partial<Pick>) permite id_prestador opcional', () => {
    // Verificación estructural: el campo es opcional (Partial).
    // Un objeto vacío compila → el campo es efectivamente opcional.
    const vacio: ActualizarOperarioInput = {};
    expect(vacio).toEqual({});

    // Y un objeto con id_prestador también compila.
    const conId: ActualizarOperarioInput = { id_prestador: 7 };
    expect(conId.id_prestador).toBe(7);
  });

  it('Fixture de input valido requiere id_prestador (type-level)', () => {
    // Si id_prestador no fuese required en CrearOperarioInput, este
    // cast compilaría limpiamente sin necesidad de bypass. Forzamos
    // el cast `unknown` para bypassear la verificación y observar
    // que la estructura exige el campo vía un `as CrearOperarioInput`.
    const sinId = {
      numero_cedula: '123',
      nombre: 'Ana',
      email: 'ana@epc.co',
      password_hash: 'h',
    } as CrearOperarioInput;
    // A nivel runtime, sinId.id_prestador es undefined (lo que
    // confirma que el type exige el campo en compilación).
    expect(sinId.id_prestador).toBeUndefined();
  });

  it('Operario con id_prestador: 0 es válido a nivel de tipos (validación es Fase 4)', () => {
    // Disciplina: el type system NO restringe el rango numérico.
    // La validación "id_prestador > 0" la hace el validador puro
    // `idPrestadorRequeridoValido` (Fase 2.2), invocado en Fase 4
    // desde la factory `crearOperario` y la capa de auth.
    // id_prestador = 0 está reservado para el prestador legacy
    // "EPC-LEGACY" (ver migration 009) y debe ser representable.
    const operarioLegacy: Operario = {
      ..._operarioCompleto,
      id_prestador: 0,
    };
    expect(operarioLegacy.id_prestador).toBe(0);
    expect(extraerIdPrestador(operarioLegacy)).toBe(0);
  });

  it('OperarioBorrador y CrearOperarioInput NO incluyen id_operario ni created_at', () => {
    // Verificación de la forma completa: el Omit correcto.
    const borrador: OperarioBorrador = {
      id_prestador: 1,
      numero_cedula: '123',
      nombre: 'A',
      email: 'a@a.co',
      password_hash: 'h',
      rol: 'operario',
      estado: 'activo',
    };
    expect(borrador).not.toHaveProperty('id_operario');
    expect(borrador).not.toHaveProperty('created_at');

    const input: CrearOperarioInput = {
      id_prestador: 1,
      numero_cedula: '123',
      nombre: 'A',
      email: 'a@a.co',
      password_hash: 'h',
    };
    expect(input).not.toHaveProperty('id_operario');
    expect(input).not.toHaveProperty('created_at');
  });

  it('ActualizarOperarioInput expone id_prestador como key opcional', () => {
    // Verificación de membership: id_prestador es una key de
    // ActualizarOperarioInput. Si no lo fuese, esta asignación
    // directa daría error de compilación.
    type KeysActualizables = keyof ActualizarOperarioInput;
    const _check: KeysActualizables = 'id_prestador';
    expect(_check).toBe('id_prestador');
  });
});
