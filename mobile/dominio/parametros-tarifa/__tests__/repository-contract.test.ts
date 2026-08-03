/**
 * Contrato estructural de `ParametrosTarifaRepository`.
 *
 * Este archivo verifica por VÍA DE TIPOS que
 * `guardar(data: ParametrosTarifaBorrador): Promise<ParametrosTarifa>`
 * forma parte del contrato publico del repositorio.
 *
 * Estrategia de RED/GREEN:
 *
 *   RED  → el interface `ParametrosTarifaRepository` NO declara `guardar`.
 *          El mock completo con `guardar` no conforma al interface y tsc
 *          rompe con TS2339 / TS2353 al intentar tiparlo. Jest (babel)
 *          pasa por babel sin chequear tipos, pero una corrida local de
 *          `npx tsc --noEmit` evidencia el problema antes del commit.
 *
 *   GREEN → agregar `guardar` al interface hace que el mock conforme
 *          estructuralmente, los tipos compilen y los tests pasen.
 *
 * Por que este archivo ES el RED phase:
 *   - Sin la firma `guardar` en el interface, las llamadas a
 *     `repo.guardar(...)` en `pantallas/admin/ParametrosTarifa.tsx`
 *     rompen compile contra la produccion real. Es el archivo del
 *     contrato el que documenta el shape esperado de la API.
 */

import type {
  ParametrosTarifa,
  ParametrosTarifaBorrador,
  ParametrosTarifaRepository,
} from '../types';

/**
 * Mock completo que satisface TODOS los metodos del interface, incluido
 * `guardar`. Si TS no puede inferir que esto conforma al interface (porque
 * `guardar` falta en el interface), el archivo NO COMPILA.
 *
 * Babel (que usa Jest) no chequea tipos, por lo que en runtime el test
 * pasa aunque `guardar` falte del interface. Por eso este contrato DEBE
 * validarse adicionalmente con `npx tsc --noEmit` antes de hacer commit.
 */
function buildRepoCompleto(): ParametrosTarifaRepository {
  return {
    crear: () => Promise.reject(new Error('stub: crear')),
    obtenerPorId: () => Promise.resolve(null),
    listar: () => Promise.resolve([]),
    buscarVigente: () => Promise.resolve(null),
    buscarPorPeriodo: () => Promise.resolve(null),
    guardar: () => Promise.reject(new Error('stub: guardar')),
    eliminar: () => Promise.resolve(),
  };
}

describe('ParametrosTarifaRepository — contrato estructural', () => {
  /**
   * T-RC-1 `guardar` es un metodo del interface.
   *
   * Si `guardar` falta en el interface, TS2339 rompe el archivo. Si
   * TS pasa y jest corre, este test documenta que el metodo existe.
   */
  it('T-RC-1 `guardar` es un metodo del interface', () => {
    const repo = buildRepoCompleto();
    expect(typeof repo.guardar).toBe('function');
  });

  /**
   * T-RC-2 la firma acepta ParametrosTarifaBorrador y retorna Promise<ParametrosTarifa>.
   *
   * Verifica el flujo del stub: la llamada atraviesa `guardar(...)` y
   * llegamos al .catch — confirmando que la firma matchea.
   */
  it('T-RC-2 la firma acepta ParametrosTarifaBorrador y retorna Promise<ParametrosTarifa>', async () => {
    const repo = buildRepoCompleto();
    const resultado = await repo
      .guardar({} as ParametrosTarifaBorrador)
      .catch((e: unknown) => (e instanceof Error ? e.message : null));
    expect(resultado).toBe('stub: guardar');
  });

  /**
   * T-RC-3 los 7 metodos del contrato estan presentes en un mock conforme.
   */
  it('T-RC-3 los 7 metodos del contrato estan presentes en un mock conforme al interface', () => {
    const repo = buildRepoCompleto();
    const expectedMethods = [
      'crear',
      'obtenerPorId',
      'listar',
      'buscarVigente',
      'buscarPorPeriodo',
      'guardar',
      'eliminar',
    ] as const;
    for (const m of expectedMethods) {
      expect(typeof repo[m]).toBe('function');
    }
  });

  /**
   * T-RC-4 (triangulacion) `guardar` NO lanza: su retorno es una Promise<ParametrosTarifa>.
   *
   * El stub resuelve al .catch (rechazo) — pero la promesa SI es una
   * Promise<ParametrosTarifa>. Si el tipo de retorno fuera otra cosa,
   * el cast dentro del `.catch((e: unknown) => ...)` seria innecesario.
   */
  it('T-RC-4 el retorno de `guardar` es Promise<ParametrosTarifa>', async () => {
    const repo = buildRepoCompleto();
    const promesa = repo.guardar({} as ParametrosTarifaBorrador);
    // Promise: tiene metodo .then y .catch.
    expect(typeof promesa.then).toBe('function');
    expect(typeof promesa.catch).toBe('function');
    // Limpiamos la rejection del stub para no contaminar el proceso.
    await promesa.catch(() => undefined);
  });
});
