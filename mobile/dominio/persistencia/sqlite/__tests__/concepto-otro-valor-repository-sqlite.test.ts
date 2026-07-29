/**
 * Tests del adapter Node (better-sqlite3) del repositorio
 * `ConceptoOtroValorRepository`.
 *
 * TDD: tests que validan el contrato del adapter tras la migration 021.
 * Cobertura:
 *   - T-5.6: seed completo (7 conceptos) tras migration 021.
 *   - T-5.7: re-aplicar la migration no rompe (idempotencia via `INSERT OR IGNORE`).
 *   - T-5.8: `listar()` retorna códigos en mayúsculas (normalización).
 *   - T-5.9: `requiere_glosa` correcto por concepto.
 *   - T-5.10: `activo` se serializa como boolean (no 0/1).
 *   - T-5.11: `created_at` se serializa como ISO 8601 string.
 *   - T-5.12: `__migraciones_aplicadas` (user_version) llega a 21 tras apply.
 *   - T-5.13: orden estable de `listar()` (orden de inserción del seed).
 */

import Database from 'better-sqlite3';
import { crearConceptoOtroValorRepositorySqlite } from '../concepto-otro-valor-repository-sqlite';
import { CODIGOS_CONCEPTO_OTRO_VALOR, CATALOGO_VERSION_INICIAL } from '../../../concepto-otro-valor/types';

function crearDbTest(): Database.Database {
  const db = new Database(':memory:');
  return db;
}

describe('ConceptoOtroValorRepositorySqlite', () => {
  it('T-5.6: migration 021 siembra 7 conceptos canónicos', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      const conceptos = await repo.listar();
      expect(conceptos).toHaveLength(CODIGOS_CONCEPTO_OTRO_VALOR.length);
      for (const codigo of CODIGOS_CONCEPTO_OTRO_VALOR) {
        expect(conceptos.find((c) => c.codigo === codigo)).toBeDefined();
      }
    } finally {
      db.close();
    }
  });

  it('T-5.7: la migration es idempotente (re-aplicar no duplica)', async () => {
    const db = crearDbTest();
    try {
      const repo1 = crearConceptoOtroValorRepositorySqlite(db);
      const conceptosInicial = await repo1.listar();
      const repo2 = crearConceptoOtroValorRepositorySqlite(db);
      const conceptosFinal = await repo2.listar();
      expect(conceptosInicial).toHaveLength(7);
      expect(conceptosFinal).toHaveLength(7);
    } finally {
      db.close();
    }
  });

  it('T-5.8: códigos se canonicalizan en MAYUSCULAS', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      for (const codigo of await repo.listar()) {
        expect(codigo.codigo).toBe(codigo.codigo.toUpperCase());
      }
    } finally {
      db.close();
    }
  });

  it('T-5.9: requiere_glosa coherente: RECONEXION false, INTERESES_AUTORIZADOS true', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      const reconexion = await repo.buscarPorCodigo('RECONEXION');
      const intereses = await repo.buscarPorCodigo('INTERESES_AUTORIZADOS');
      expect(reconexion?.requiereGlosa).toBe(false);
      expect(intereses?.requiereGlosa).toBe(true);
    } finally {
      db.close();
    }
  });

  it('T-5.10: activo se serializa como boolean (no 0/1)', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      for (const concepto of await repo.listar()) {
        expect(typeof concepto.activo).toBe('boolean');
        expect(concepto.activo).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('T-5.11: created_at ISO 8601 con milisegundos', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      for (const concepto of await repo.listar()) {
        expect(concepto.createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
      }
    } finally {
      db.close();
    }
  });

  it('T-5.12: tras apply de migrations, user_version llega a >= 21', async () => {
    const db = crearDbTest();
    try {
      await crearConceptoOtroValorRepositorySqlite(db).listar();
      const userVersion = db.pragma('user_version', { simple: true }) as number;
      expect(userVersion).toBeGreaterThanOrEqual(21);
    } finally {
      db.close();
    }
  });

  it('T-5.13: listar() es estable (mismo orden entre invocaciones)', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      const first = (await repo.listar()).map((c) => c.codigo);
      const second = (await repo.listar()).map((c) => c.codigo);
      expect(second).toEqual(first);
    } finally {
      db.close();
    }
  });

  it('T-5.X: buscarPorCodigo es case-insensitive', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      const upper = await repo.buscarPorCodigo('SALDO_ANTERIOR');
      const lower = await repo.buscarPorCodigo('saldo_anterior');
      const mixed = await repo.buscarPorCodigo('SaLdO_AnTeRiOr');
      expect(upper).not.toBeNull();
      expect(lower).not.toBeNull();
      expect(mixed).not.toBeNull();
      expect(upper?.idConcepto).toBe(lower?.idConcepto);
      expect(lower?.idConcepto).toBe(mixed?.idConcepto);
    } finally {
      db.close();
    }
  });

  it('T-5.Y: todos los conceptos seed llevan la version regulatoria 1038-2026-v1', async () => {
    const db = crearDbTest();
    try {
      const repo = crearConceptoOtroValorRepositorySqlite(db);
      for (const concepto of await repo.listar()) {
        expect(concepto.version).toBe(CATALOGO_VERSION_INICIAL);
      }
    } finally {
      db.close();
    }
  });
});
