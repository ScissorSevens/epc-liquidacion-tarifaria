/**
 * Gate `validarAmbito` — confirma ámbito tarifario antes de liquidar.
 *
 * Pure function conforme a Res CRA 825/2017 + Res CRA 1032/2026 (24/03/2026).
 *
 * Reglas:
 *   - cantidad_suscriptores=null → INDETERMINADO (bootstrap inicial)
 *   - cantidad_suscriptores>5000 URBANA → APLICA Subtítulo 1 (CRA 1032/2026)
 *   - cantidad_suscriptores>5000 MIXTA → APLICA Subtítulo 1 (asume >50% urbanos;
 *     refinamiento futuro: distinguir porcentaje urbano vs rural)
 *   - cantidad_suscriptores<=5000 cualquier zona → APLICA Subtítulo 2
 *     (CRA 825/2017 + art. 31.B inversiones ambientales)
 *
 * Fase 2 (`param-tarifa-res-825-compliance-phase2`), task 1.3 GREEN.
 */

import type {
  PrestadorAmbitoInfo,
  ResultadoAmbito,
  EstadoAmbito,
  SubtituloCRA,
} from './types';

const UMBRAL_SUBTITULO_1 = 5_000;

/**
 * Evalúa el ámbito tarifario de un prestador conforme a Res CRA 825/2017 +
 * Res CRA 1032/2026 art. 2.1.2.1.1.1.
 *
 * @param prestador  Información mínima del prestador (desacoplada del
 *                   aggregate `Prestador`).
 * @param fecha      ISO 8601 de la liquidación propuesta.
 * @returns          `ResultadoAmbito` inmutable con estado, subtítulo,
 *                   norma aplicable y evidencia para auditoría.
 */
export function validarAmbito(
  prestador: PrestadorAmbitoInfo,
  fecha: string,
): ResultadoAmbito {
  // Caso 1: sin dato de suscriptores → INDETERMINADO.
  // IMPORTANTE: chequear `=== null` ANTES que `<= 0` porque en JS
  // `null <= 0` es `true` (null se convierte a 0 en comparación numérica)
  // y NO queremos capturar null en este branch.
  if (prestador.cantidad_suscriptores === null) {
    return {
      estado: 'INDETERMINADO',
      subtitulo: null,
      normaAplicable: null,
      evidencia: `cantidad_suscriptores_indefinida para prestador ${prestador.id_prestador} zona ${prestador.zona}`,
      fecha_verificacion: fecha,
    };
  }

  // Caso 0: cantidad inválida (≤ 0 explícito, NO null porque null se
  // manejó arriba) → NO_APLICA. Un prestador con 0 suscriptores o
  // valor negativo NO puede recibir liquidación.
  if (prestador.cantidad_suscriptores <= 0) {
    return {
      estado: 'NO_APLICA',
      subtitulo: null,
      normaAplicable: null,
      evidencia: `cantidad_suscriptores inválida (${prestador.cantidad_suscriptores}) para prestador ${prestador.id_prestador}`,
      fecha_verificacion: fecha,
    };
  }

  const suscriptores = prestador.cantidad_suscriptores;
  const supera_umbral = suscriptores > UMBRAL_SUBTITULO_1;

  // Caso 2: >5000 suscriptores con zona URBANA o MIXTA → Subtítulo 1.
  // (Refinamiento futuro: distinguir MIXTA con ≤50% urbanos → Subtítulo 2.)
  if (supera_umbral && (prestador.zona === 'URBANA' || prestador.zona === 'MIXTA')) {
    return {
      estado: 'APLICA',
      subtitulo: 1,
      normaAplicable: 'CRA_1032_2026_SUBTITULO_1',
      evidencia: `${suscriptores} suscriptores, zona ${prestador.zona} (>5000) — Subtítulo 1 metodologías grandes prestadores`,
      fecha_verificacion: fecha,
    };
  }

  // Caso 3: cualquier otro caso (≤5000, o >5000 rurales puros) → Subtítulo 2.
  // Para RURAL con >5000 suscriptores (caso edge): la CRA 1032/2026 art.
  // 2.1.2.1.1.7 define EDR (Esquema Diferencial Rural) que aplicaría dentro
  // del Subtítulo 1, pero para mantener el modelo simple lo dejamos en
  // Subtítulo 2 con CRA 825/2017. Es un conservadorismo razonable para
  // un proyecto piloto.
  return {
    estado: 'APLICA',
    subtitulo: 2,
    normaAplicable: 'CRA_825_2017',
    evidencia: `${suscriptores} suscriptores, zona ${prestador.zona} (≤5000 o rural) — Subtítulo 2 metodología CRA 825/2017`,
    fecha_verificacion: fecha,
  };
}
