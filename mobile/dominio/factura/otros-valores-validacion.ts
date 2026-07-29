/**
 * Helper de validacion de `otros_valores` contra una fuente de catalogo.
 *
 * Antes de este modulo, `emitirFacturaSync` y `emitirFacturaAsync` duplicaban
 * la logica de "para cada `OtroValor`, validar que el codigo exista en
 * el catalogo" — la unica diferencia era la fuente de datos
 * (constante legacy vs `ConceptoOtroValorRepository`). Code review
 * 2026-07-29 (REQUIRED #2): extraer este helper para que ambas rutas
 * compartan la misma logica de validacion.
 *
 * ## Diseno
 *
 * `CatalogoFuente` es un port minimo (`existe` + `activo`) que admite
 * multiples implementaciones:
 *
 *  1. `CatalogoLegacy` — wrap a `OtrosValoresCatalogo` (constante
 *     hardcoded, deprecated fallback). Acepta todos los codigos del
 *     constante. Mantiene paridad 1:1 con el comportamiento previo
 *     del sync path.
 *
 *  2. `CatalogoMapa` — adapter que toma un `Map<codigo, ConceptoOtroValor>`
 *     pre-cargado (generalmente desde `catalogoRepo.listar()`). Sync:
 *     consulta el Map en O(1). Esta es la forma que usa
 *     `emitirFacturaAsync` despues de pre-cargar el catalogo.
 *
 * `validarOtrosValores(otrosValores, fuente)` itera la lista y
 * delega la decision a la fuente. Lanza `CONCEPTO_NO_AUTORIZADO`
 * si la fuente reporta que un codigo no existe o no esta activo.
 *
 * ## Pureza
 *
 * El helper es 100% sync y puro: no muta `otrosValores` ni la fuente.
 * Las implementaciones tambien son sync — la fuente de datos ya fue
 * resuelta por el caller (ej: `await catalogoRepo.listar()` antes
 * de construir el Map).
 *
 * @see `../factura/otros-valores-catalogo.ts` — fuente legacy
 * @see `../concepto-otro-valor` — repo SQLite
 * @see `../factura/factura.ts` — emitirFacturaSync / emitirFacturaAsync
 */

import type { ConceptoOtroValor } from '../concepto-otro-valor';
import { MENSAJES_ERROR_FACTURA, type OtroValor } from './types';

/**
 * Puerto minimo de fuente de catalogo. Sync por design: las
 * implementaciones pre-cargan los datos en su constructor para
 * que `validarOtrosValores` sea sync y simple.
 *
 * Para integrar con `ConceptoOtroValorRepository` (async), usar
 * `CatalogoMapa(repo.listar())` — el caller hace el `await listar()`
 * y construye el Map, que se pasa a `validarOtrosValores` sin mas.
 */
export interface CatalogoFuente {
  /** El codigo existe en el catalogo (sin importar su estado). */
  existe(codigo: string): boolean;
  /** El codigo existe Y esta activo (regulatoriamente utilizable). */
  activo(codigo: string): boolean;
}

/**
 * `CatalogoLegacy` (phase-out): acepta TODOS los codigos sin validar.
 *
 * Tras el phase-out de `OtrosValoresCatalogo` (Task 5 de
 * `factura-compliance-cleanup`), esta clase es un shim no-op: NO
 * consulta ninguna constante ni hace lookup. Sirve como "fuente
 * permisiva" para `emitirFacturaSync`, que adopta la semantica
 * "trust the caller" — si el caller construyo el `OtroValor`
 * via UI, asume que la seleccion fue correcta.
 *
 * La validacion regulatoria REAL ocurre exclusivamente en la ruta
 * async (`emitirFacturaAsync` con `catalogoRepo` inyectado), que usa
 * `CatalogoMapa` y rechaza codigos inexistentes o inactivos.
 *
 * Antes de Task 5, esta clase validaba contra la constante
 * hardcoded `OtrosValoresCatalogo`. Esa constante ya no existe; el
 * dominio regulatorio migro a la tabla SQLite `concepto_otro_valor`
 * con `version = '1038-2026-v1'`.
 */
export class CatalogoLegacy implements CatalogoFuente {
  existe(_codigo: string): boolean {
    // Acepta todo: la responsabilidad de filtrar codigos es del caller
    // (UI + emitFacturaAsync con catalogoRepo).
    return true;
  }
  activo(_codigo: string): boolean {
    return true;
  }
}

/**
 * Adapter que toma una lista (o Map) de `ConceptoOtroValor` y
 * expone un `CatalogoFuente` sync con lookup O(1) por codigo.
 *
 * Caso de uso: `emitirFacturaAsync` hace
 *   `const lista = await catalogoRepo.listar();`
 *   `const fuente = CatalogoMapa.desdeLista(lista);`
 *   `validarOtrosValores(otrosValores, fuente);`
 *
 * Si `lista` esta vacia, `existe()` y `activo()` siempre retornan
 * `false` (caller decide si lanzar error o warn+fallback).
 *
 * ## Performance
 *
 * Indexa la lista en un `Map<codigo, ConceptoOtroValor>` en el
 * constructor (O(n) one-shot). Cada `existe()` / `activo()` es O(1).
 * Validar M `otrosValores` contra un catalogo de N conceptos cuesta
 * O(n) (indexar) + O(m) (lookups) — versus O(n*m) del patron
 * `conceptos.find(c => c.codigo === ov.concepto)` previo.
 *
 * En la practica, con N=7 (seed regulatorio actual) y M=2..5
 * (otrosValores tipicos), la diferencia es despreciable. La
 * optimizacion paga cuando N crezca (ej: regulacion agrega 50
 * conceptos, o el repo carga catalogos historicos en batch).
 */
export class CatalogoMapa implements CatalogoFuente {
  private readonly mapa: ReadonlyMap<string, ConceptoOtroValor>;

  constructor(mapa: ReadonlyMap<string, ConceptoOtroValor>) {
    this.mapa = mapa;
  }

  /** Constructor conveniente: indexa la lista por codigo (upper-case). */
  static desdeLista(lista: readonly ConceptoOtroValor[]): CatalogoMapa {
    const mapa = new Map<string, ConceptoOtroValor>();
    for (const c of lista) {
      mapa.set(c.codigo.toUpperCase(), c);
    }
    return new CatalogoMapa(mapa);
  }

  existe(codigo: string): boolean {
    return this.mapa.has(codigo.toUpperCase());
  }

  activo(codigo: string): boolean {
    const c = this.mapa.get(codigo.toUpperCase());
    return c !== undefined && c.activo;
  }
}

/**
 * Itera `otrosValores` y, por cada uno, consulta la fuente. Si la
 * fuente retorna `false` para `activo` (o para `existe`), lanza
 * `Error(MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO)`.
 *
 * El match contra el catalogo es case-insensitive: `ov.concepto` se
 * normaliza a `toUpperCase()` antes de consultar, porque el dominio
 * `ConceptoOtroValor` trabaja en upper-case pero los inputs de
 * frontera (DB corrupta, JSON round-trip) pueden traer cualquier case.
 *
 * @throws `Error(MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO)` si
 *         algun codigo no existe o no esta activo.
 */
export function validarOtrosValores(
  otrosValores: readonly OtroValor[],
  fuente: CatalogoFuente,
): void {
  for (const ov of otrosValores) {
    const codigo = ov.concepto.toUpperCase();
    if (!fuente.activo(codigo)) {
      throw new Error(MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO);
    }
  }
}
