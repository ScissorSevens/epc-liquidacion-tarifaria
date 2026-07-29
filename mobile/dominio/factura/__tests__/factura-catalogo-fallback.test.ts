/**
 * Tests del path async de `emitirFactura` con `catalogoRepo`.
 *
 * Cambio introducido en `factura-compliance-hardening` Task 6:
 *  - emitirFactura acepta un 5to param `catalogoRepo?` opcional.
 *  - Si esta presente y poblado (>0 conceptos), valida contra la DB.
 *  - Si esta vacio o ausente, fallback a constante legacy `OtrosValoresCatalogo`.
 *  - Compat 100% con callers que pasan 4 args (legacy) — Task 6 mantiene firma
 *    sync.
 *  - El overload sync retorna `Factura`, el overload async retorna
 *    `Promise<Factura>`. TypeScript resuelve via overloads.
 *
 * Cobertura minima (Task 6). Mas tests viven en
 * `factura-otros-valores.test.ts` (legacy sync) y llegaran en Task 7.
 */

'use strict';

import { emitirFactura } from '../factura';
import type { ConceptoOtroValorRepository, ConceptoOtroValor } from '../../concepto-otro-valor';

function crearRepoVacio(): ConceptoOtroValorRepository {
  return {
    async listar() {
      return [];
    },
    async buscarPorCodigo() {
      return null;
    },
  };
}

function crearRepoCon(items: readonly ConceptoOtroValor[]): ConceptoOtroValorRepository {
  return {
    async listar() {
      return items;
    },
    async buscarPorCodigo(codigo: string) {
      return items.find((c) => c.codigo === codigo.toUpperCase()) ?? null;
    },
  };
}

describe('emitirFactura — overload del catalogoRepo (Task 6)', () => {
  it('T-6.A: la firma acepta catalogoRepo como 5to arg', async () => {
    // Verificacion de overload: si pasamos repo, el resultado es Promise.
    const repoVacio = crearRepoVacio();
    const result = emitirFactura(
      {} as Parameters<typeof emitirFactura>[0],
      { sha256: () => 'hash' },
      undefined,
      undefined,
      repoVacio,
    );
    expect(result).toBeInstanceOf(Promise);
    // Swallow any rejection from the body (input vacio) — el test es overload.
    try {
      await result;
    } catch {
      /* ignore */
    }
  });

  it('T-6.B: la firma sin repo retorna Factura (sync) o lanza', () => {
    // Verificacion de overload: sin repo (4 args) → sync.
    // Como pasar input vacio fallaria el resto de validaciones, capturamos
    // el error. Lo importante es que NO es una Promise.
    let captured: unknown;
    try {
      emitirFactura(
        {} as Parameters<typeof emitirFactura>[0],
        { sha256: () => 'hash' },
      );
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeDefined();
  });

  it('T-6.C: emitirFactura devuelve un Promise cuando se pasa catalogoRepo', async () => {
    const repo = crearRepoCon([
      {
        idConcepto: 1,
        codigo: 'RECONEXION',
        descripcion: 'a',
        version: '1038-2026-v1',
        activo: true,
        requiereGlosa: false,
        createdAt: '2026-07-29T00:00:00.000Z',
      },
    ]);
    const result = emitirFactura(
      {} as Parameters<typeof emitirFactura>[0],
      { sha256: () => 'hash' },
      undefined,
      undefined,
      repo,
    );
    expect(result).toBeInstanceOf(Promise);
    // Capturamos cualquier error subsecuente (input vacio falla validacion
    // post-catalogo — esto es esperado para este test de overload).
    try {
      await result;
    } catch {
      // Ignorar validacion de input — el test es de OVERLOAD.
    }
  });

  it('T-6.D: typecheck — el overload distingue sync vs Promise<Factura>', () => {
    // No test runtime, solo typecheck del overload.
    function _typecheck(): void {
      const repo: ConceptoOtroValorRepository = crearRepoVacio();
      // Sync path
      const syncResult: { readonly id: string } = emitirFactura(
        {} as Parameters<typeof emitirFactura>[0],
        { sha256: () => 'hash' },
      );
      void syncResult;
      // Async path
      const asyncResult: Promise<{ readonly id: string }> = emitirFactura(
        {} as Parameters<typeof emitirFactura>[0],
        { sha256: () => 'hash' },
        undefined,
        undefined,
        repo,
      );
      void asyncResult;
    }
    void _typecheck;
  });
});
