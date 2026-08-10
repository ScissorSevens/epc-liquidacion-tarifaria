// mobile/__tests__/pantallas/admin/parametros-tarifa-build-borrador.test.ts
//
// Tests contractuales del helper `buildBorradorLocal` — extraido del
// `guardar()` de ParametrosTarifa.tsx para ser reusado por:
//   - `guardar()` (al persistir)
//   - `useMemo()` del card `ResumenCargos` (live preview)
//
// D2 (parametros-tarifa-impeccable-v2): `calcularCargos(p)` exige el
// shape COMPLETO de ParametrosTarifa (no partial). El helper debe
// construir ese shape desde los FormValues del state local del screen.
//
// Cobertura:
//   T-BB-1  Construye shape COMPLETO de ParametrosTarifa con todos los
//           campos requeridos por `calcularCargos()`.
//   T-BB-2  Filtra `componentes_aplicables`: SIN CMVIAA cuando
//           `aplica_cmviaa=false` (D2 hallazgo critico del design).
//   T-BB-3  Incluye CMVIAA en `componentes_aplicables` cuando
//           `aplica_cmviaa=true`.
//   T-BB-4  Propaga `id_prestador` y `id_acuerdo` desde el contexto.
//
// TDD Evidence:
//   RED  → modulo no existe. Import tira Cannot find module.
//   GREEN → implementacion. Tests pasan.

import type { ParametrosTarifa } from '../../../dominio/parametros-tarifa/types';
import { COMPONENTES_TARIFARIOS } from '../../../dominio/parametros-tarifa/calcular';
import { buildBorradorLocal, type FormValues } from '../../../src/pantallas/admin/parametros-tarifa-build-borrador';

const formCompleto: FormValues = {
  periodo: '2026',
  anioBase: '2016',
  cma: '12000000',
  cmo: '800',
  cmi: '200',
  cmt: '100',
  cmviaa: '500',
  cmaa: '1500',
  aplicaCmviaa: true,
  // Phase 2 task 2.4 (GREEN): flag explicito CMAA. Default false
  // para data legacy pre-Phase 2; aqui lo activamos para verificar
  // que el buildBorradorLocal propaga el flag y el valor numerico.
  aplicaCmaa: true,
  actoAdopcion: 'https://example.com/decreto-042-2024',
  estudioCostosId: 'SUI-2024-EST-001',
  documentoSoporteUrl: 'https://example.com/estudio-costos.pdf',
  aguaSuministrada: '50000',
  ipuf: '6',
  suscriptoresPromedio: '300',
  aplicaMinimoVital: false,
  m3Gratis: '0',
  vigenteDesde: '2025-01-01',
  vigenteHasta: '2029-12-31',
  altitud: '2600',
};

const ctx = { id_prestador: 7, id_acuerdo: 100 };

describe('buildBorradorLocal — helper extraido de guardar()', () => {
  // ── T-BB-1: shape COMPLETO ──────────────────────────────────────────────
  describe('T-BB-1: construye shape COMPLETO de ParametrosTarifa', () => {
    it('el resultado tiene TODOS los campos que calcularCargos() espera', () => {
      const borrador = buildBorradorLocal(formCompleto, ctx);
      // El shape debe satisfacer la interface ParametrosTarifa (parcial
      // para este test — sin id_parametros/created_at que se setean al
      // persistir).
      const camposEsperados: (keyof ParametrosTarifa)[] = [
        'cma',
        'cmo',
        'cmi',
        'cmt',
        'cmviaa',
        'aplica_cmviaa',
        'agua_suministrada_m3_anio',
        'ipuf_m3_suscriptor_mes',
        'suscriptores_promedio',
        'aplica_minimo_vital',
        'm3_gratis_minimo_vital',
        'componentes_aplicables',
        'vigente_desde',
        'vigente_hasta',
      ];
      for (const campo of camposEsperados) {
        expect(borrador).toHaveProperty(campo);
      }
    });

    it('convierte strings del form a numeros en los campos numericos', () => {
      const borrador = buildBorradorLocal(formCompleto, ctx);
      expect(borrador.cma).toBe(12_000_000);
      expect(borrador.cmo).toBe(800);
      expect(borrador.cmi).toBe(200);
      expect(borrador.cmt).toBe(100);
      expect(borrador.cmviaa).toBe(500);
      expect(borrador.agua_suministrada_m3_anio).toBe(50_000);
      expect(borrador.ipuf_m3_suscriptor_mes).toBe(6);
      expect(borrador.suscriptores_promedio).toBe(300);
      expect(borrador.periodo).toBe(2026);
      expect(borrador.anio_base).toBe(2016);
    });

    it('preserva las fechas como string ISO (YYYY-MM-DD)', () => {
      const borrador = buildBorradorLocal(formCompleto, ctx);
      expect(borrador.vigente_desde).toBe('2025-01-01');
      expect(borrador.vigente_hasta).toBe('2029-12-31');
    });

    it('propaga id_prestador e id_acuerdo del contexto', () => {
      const borrador = buildBorradorLocal(formCompleto, ctx);
      expect(borrador.id_prestador).toBe(7);
      expect(borrador.id_acuerdo).toBe(100);
    });
  });

  // ── T-BB-2: componentes_aplicables sin CMVIAA ───────────────────────────
  describe('T-BB-2: aplica_cmviaa=false excluye CMVIAA de componentes_aplicables', () => {
    it('el array de componentes NO contiene CMVIAA', () => {
      const formSinCmviaa: FormValues = { ...formCompleto, aplicaCmviaa: false };
      const borrador = buildBorradorLocal(formSinCmviaa, ctx);
      expect(borrador.componentes_aplicables).not.toContain('CMVIAA');
      // El resto de componentes sigue presente.
      expect(borrador.componentes_aplicables).toContain('CMA');
      expect(borrador.componentes_aplicables).toContain('CMO');
      expect(borrador.componentes_aplicables).toContain('CMI');
      expect(borrador.componentes_aplicables).toContain('CMT');
    });

    it('cmviaa se mantiene en 0 cuando aplica_cmviaa=false', () => {
      const formSinCmviaa: FormValues = { ...formCompleto, aplicaCmviaa: false, cmviaa: '500' };
      const borrador = buildBorradorLocal(formSinCmviaa, ctx);
      // El input `cmviaa` se ignora cuando aplica_cmviaa=false
      // (calcularCargos lo trata como 0).
      expect(borrador.cmviaa).toBe(0);
    });
  });

  // ── T-BB-3: componentes_aplicables con CMVIAA ───────────────────────────
  describe('T-BB-3: aplica_cmviaa=true incluye CMVIAA en componentes_aplicables', () => {
    it('el array de componentes contiene TODOS los 5 canonicos', () => {
      const borrador = buildBorradorLocal(formCompleto, ctx);
      expect(borrador.componentes_aplicables).toContain('CMVIAA');
      expect(borrador.componentes_aplicables).toContain('CMA');
      expect(borrador.componentes_aplicables).toContain('CMO');
      expect(borrador.componentes_aplicables).toContain('CMI');
      expect(borrador.componentes_aplicables).toContain('CMT');
      // Tamano: 5.
      expect(borrador.componentes_aplicables).toHaveLength(COMPONENTES_TARIFARIOS.length);
    });
  });

  // ── T-BB-4: filtros m3 gratis segun aplica_minimo_vital ─────────────────
  describe('T-BB-4: aplica_minimo_vital=false excluye m3_gratis', () => {
    it('m3_gratis_minimo_vital se mantiene en 0 cuando aplica_minimo_vital=false', () => {
      const formSinMinimo: FormValues = {
        ...formCompleto,
        aplicaMinimoVital: false,
        m3Gratis: '50',
      };
      const borrador = buildBorradorLocal(formSinMinimo, ctx);
      // El input m3Gratis se ignora cuando aplica_minimo_vital=false.
      expect(borrador.m3_gratis_minimo_vital).toBe(0);
    });

    it('m3_gratis_minimo_vital refleja el valor cuando aplica_minimo_vital=true', () => {
      const formConMinimo: FormValues = {
        ...formCompleto,
        aplicaMinimoVital: true,
        m3Gratis: '20',
      };
      const borrador = buildBorradorLocal(formConMinimo, ctx);
      expect(borrador.m3_gratis_minimo_vital).toBe(20);
      expect(borrador.aplica_minimo_vital).toBe(true);
    });
  });

  // ── T-BB-5 — Fase 2 (param-tarifa-res-825-compliance-phase2, task 4.6 RED):
  // los 4 campos nuevos del screen (cmaa, acto_adopcion, estudio_costos_id,
  // documento_soporte_url) deben mapearse correctamente al borrador
  // persistible. Antes de este fix, los campos se ignoraban: el admin
  // los tipeaba pero `buildBorradorLocal` no los exponía, y al
  // `repo.guardar()` llegaba `cmaa: undefined`, `acto_adopcion: undefined`,
  // etc. Tras este test (RED), verificamos que los 4 valores se
  // preservan tal cual en el output.
  describe('T-BB-5: campos nuevos de soporte documental (Fase 2)', () => {
    it('T-BB-5.1 incluye cmaa numerico parseado al output', () => {
      const borrador = buildBorradorLocal(formCompleto, ctx);
      // cmaa del fixture: '1500' → 1500 (number).
      expect(borrador.cmaa).toBe(1500);
    });

    it('T-BB-5.2 propaga acto_adopcion, estudio_costos_id y documento_soporte_url como strings', () => {
      const borrador = buildBorradorLocal(formCompleto, ctx);
      expect(borrador.acto_adopcion).toBe(
        'https://example.com/decreto-042-2024',
      );
      expect(borrador.estudio_costos_id).toBe('SUI-2024-EST-001');
      expect(borrador.documento_soporte_url).toBe(
        'https://example.com/estudio-costos.pdf',
      );
    });

    it('T-BB-5.3 strings vacios en los 3 docs se traducen a null (no a string vacia)', () => {
      // El tipo ParametrosTarifa exige `acto_adopcion?: string | null`,
      // no `string | ''`. El helper convierte '' → null para mantener
      // backward-compat con la columna SQLite (que es TEXT NULL).
      const formVacio: FormValues = {
        ...formCompleto,
        actoAdopcion: '',
        estudioCostosId: '',
        documentoSoporteUrl: '',
      };
      const borrador = buildBorradorLocal(formVacio, ctx);
      expect(borrador.acto_adopcion).toBeNull();
      expect(borrador.estudio_costos_id).toBeNull();
      expect(borrador.documento_soporte_url).toBeNull();
    });

    it('T-BB-5.4 cmaa con string vacio o NaN se convierte a 0 (number, no null)', () => {
      // A diferencia de los docs (strings opcionales), cmaa es un
      // number|null segun el diseño. Si el admin lo deja vacio, cae
      // a 0 (default limpio, NO null) para que el motor siempre vea
      // un number.
      const formCmaaVacio: FormValues = {
        ...formCompleto,
        cmaa: '',
      };
      const borrador = buildBorradorLocal(formCmaaVacio, ctx);
      expect(borrador.cmaa).toBe(0);
    });

    it('T-BB-5.5 los 4 campos del output son readonly (inmutabilidad del shape persistible)', () => {
      // El type de retorno es ParametrosTarifaBorrador: todos los
      // campos son readonly. La verificación runtime de inmutabilidad
      // puede hacerse en TypeScript; este test es contra el shape literal.
      const borrador = buildBorradorLocal(formCompleto, ctx);
      // Type assertion: TS infiere el tipo correcto del output.
      const keys: Array<keyof typeof borrador> = [
        'cmaa',
        'acto_adopcion',
        'estudio_costos_id',
        'documento_soporte_url',
      ];
      for (const k of keys) {
        expect(borrador).toHaveProperty(k);
      }
    });
  });
});