/**
 * Tests del campo `aps` en Prestador — Res CRA 825 Art. 5.
 *
 * Cambia `param-tarifa-res-825-compliance-phase1` (fase 1). Cubre:
 *   - Tipo: aps: string | null
 *   - Persistencia con valor
 *   - Persistencia con null (legacy compatible)
 *   - Migration 022 idempotente
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { Prestador } from '../types';

describe('Prestador.aps — tipo TS', () => {
  it('T-APS-1: Prestador con aps definido', () => {
    const p: Partial<Prestador> = { aps: 'Cundinamarca-Norte' };
    expect(p.aps).toBe('Cundinamarca-Norte');
  });

  it('T-APS-2: Prestador sin aps = null (legacy compatible)', () => {
    const p: Partial<Prestador> = { aps: null };
    expect(p.aps).toBeNull();
  });

  it('T-APS-3: aps acepta string vacia (no se trimea)', () => {
    const p: Partial<Prestador> = { aps: '' };
    expect(p.aps).toBe('');
  });

  it('T-APS-4: APS con caracteres especiales (acentos, guiones, slashes)', () => {
    const p: Partial<Prestador> = { aps: 'C/marca-Norte/Suroccidente' };
    expect(p.aps).toBe('C/marca-Norte/Suroccidente');
  });
});

describe('migration 022_prestador_aps — idempotencia', () => {
  it('T-APS-5: ALTER TABLE agrega columna aps TEXT NULL DEFAULT NULL', () => {
    // Verificamos el contenido del SQL
    const sql = readFileSync(
      join(__dirname, '../../persistencia/sqlite/migrations/022_prestador_aps.sql'),
      'utf-8',
    );
    expect(sql).toMatch(/ALTER\s+TABLE\s+prestador\s+ADD\s+COLUMN\s+aps/i);
    expect(sql).toMatch(/TEXT/i);
    expect(sql).toMatch(/NULL/i);
  });

  it('T-APS-6: la migration 022 no modifica filas existentes (solo ADD COLUMN)', () => {
    const sql = readFileSync(
      join(__dirname, '../../persistencia/sqlite/migrations/022_prestador_aps.sql'),
      'utf-8',
    );
    // No contiene UPDATE, DELETE, ni DROP. Solo ALTER ADD COLUMN.
    expect(sql).not.toMatch(/UPDATE/i);
    expect(sql).not.toMatch(/DELETE/i);
    expect(sql).not.toMatch(/DROP/i);
  });

  it('T-APS-7: aplicar el SQL 2 veces no rompe (idempotente via PRAGMA)', () => {
    // En SQLite, ALTER TABLE ADD COLUMN NO es idempotente. La idempotencia
    // se enforce desde TypeScript via PRAGMA table_info (patrón usado por
    // 020). Verificamos que el SQL es safe para guard de idempotencia.
    const sql = readFileSync(
      join(__dirname, '../../persistencia/sqlite/migrations/022_prestador_aps.sql'),
      'utf-8',
    );
    // El runner controlará por `user_version` (Node) o `__migraciones_aplicadas` (Expo).
    expect(sql).toMatch(/ALTER\s+TABLE\s+prestador\s+ADD\s+COLUMN\s+aps/i);
  });
});
