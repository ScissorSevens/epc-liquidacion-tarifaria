// mobile/src/pantallas/admin/parametros-tarifa-build-borrador.ts
//
// Helper `buildBorradorLocal` — extraido del `guardar()` de
// ParametrosTarifa.tsx para ser reusado por:
//
//   1. `guardar()` al persistir (parametros_tarifa.guardar)
//   2. `useMemo` del card ResumenCargos (live preview)
//
// D2 (parametros-tarifa-impeccable-v2) hallazgo critico:
//
//   `calcularCargos(p)` EXIGE el shape COMPLETO de ParametrosTarifa.
//   Pasar un partial genera campos undefined que el motor no
//   defensivamente cubre — `componentes_aplicables.includes(...)`
//   tira TypeError porque `.includes()` sobre undefined es runtime error.
//   Por eso este helper centraliza la construccion del shape completo.
//
// El helper tambien aplica las reglas de negocio que antes vivian inline:
//
//   - `aplica_cmviaa=false` → CMVIAA se quita de `componentes_aplicables`
//     y su valor se fuerza a 0 (calcularCargos lo trata igual, pero
//     persistir el valor explicito evita sorpresas en auditoria).
//   - `aplica_minimo_vital=false` → `m3_gratis_minimo_vital=0` por
//     consistencia.
//   - Strings del form se parsean a number. Strings vacios / NaN → 0.

import type { ParametrosTarifaBorrador } from '../../../dominio/parametros-tarifa/types';
import { COMPONENTES_TARIFARIOS } from '../../../dominio/parametros-tarifa/calcular';

/**
 * Shape del state local del screen ParametrosTarifa.
 * Refleja los 14 useState del componente (periodo, anioBase, cma, ...).
 */
export interface FormValues {
  readonly periodo: string;
  readonly anioBase: string;
  readonly cma: string;
  readonly cmo: string;
  readonly cmi: string;
  readonly cmt: string;
  readonly cmviaa: string;
  readonly aplicaCmviaa: boolean;
  readonly aguaSuministrada: string;
  readonly ipuf: string;
  readonly suscriptoresPromedio: string;
  readonly aplicaMinimoVital: boolean;
  readonly m3Gratis: string;
  readonly vigenteDesde: string;
  readonly vigenteHasta: string;
}

/** Contexto: id_prestador + id_acuerdo que derivan `ParametrosTarifa`. */
export interface BorradorCtx {
  readonly id_prestador: number;
  readonly id_acuerdo: number;
}

/** Parsea un string a number; NaN/empty → 0. */
function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Parsea un string a integer; NaN/empty → 0. */
function entero(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Construye un ParametrosTarifaBorrador (sin id_parametros/created_at)
 * desde los FormValues del state local. El shape es COMPLETO — el caller
 * puede pasar el resultado directo a `calcularCargos()`.
 *
 * @param form FormValues del state local (14 strings + 2 booleans).
 * @param ctx  id_prestador + id_acuerdo del workspace / bootstrap.
 * @returns ParametrosTarifaBorrador listo para `calcularCargos` o `repo.guardar`.
 */
export function buildBorradorLocal(
  form: FormValues,
  ctx: BorradorCtx,
): ParametrosTarifaBorrador {
  const componentesSinCmviaa = COMPONENTES_TARIFARIOS.filter((c) => c !== 'CMVIAA');
  return {
    id_prestador: ctx.id_prestador,
    id_acuerdo: ctx.id_acuerdo,
    periodo: entero(form.periodo),
    anio_base: entero(form.anioBase),
    cma: num(form.cma),
    cmo: num(form.cmo),
    cmi: num(form.cmi),
    cmt: num(form.cmt),
    cmviaa: form.aplicaCmviaa ? num(form.cmviaa) : 0,
    aplica_cmviaa: form.aplicaCmviaa,
    agua_suministrada_m3_anio: num(form.aguaSuministrada),
    ipuf_m3_suscriptor_mes: num(form.ipuf),
    suscriptores_promedio: entero(form.suscriptoresPromedio),
    aplica_minimo_vital: form.aplicaMinimoVital,
    m3_gratis_minimo_vital: form.aplicaMinimoVital ? entero(form.m3Gratis) : 0,
    // ipuf_indice: 1.0 = sin ajuste (Res CRA 825 Art. 7 — fase 1
    // compliance). En produccion se calcula via calcularFactorIpc().
    ipuf_indice: 1.0,
    factor_indexacion_ipc: 1.0,
    componentes_aplicables: form.aplicaCmviaa
      ? [...COMPONENTES_TARIFARIOS]
      : componentesSinCmviaa,
    minimo_vital: null,
    vigente_desde: form.vigenteDesde,
    vigente_hasta: form.vigenteHasta,
    // cargo_fijo_resultante + cargo_consumo_resultante se recalculan via
    // calcularCargos() en guardar() / useMemo. Acá los dejamos en 0
    // como placeholders (la factoría pura los ignora).
    cargo_fijo_resultante: 0,
    cargo_consumo_resultante: 0,
  };
}