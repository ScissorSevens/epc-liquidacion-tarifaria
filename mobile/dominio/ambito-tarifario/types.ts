/**
 * Tipos del módulo ÁMBITO TARIFARIO — gate de validación pre-liquidación.
 *
 * Conforme a la Resolución CRA 825/2017 + Res CRA 1032/2026 (vigente
 * desde 24/03/2026), el sistema debe confirmar el ámbito de aplicación
 * del régimen tarifario antes de emitir cualquier factura.
 *
 * La 1032/2026 redefine los segmentos:
 *   - Subtítulo 1: prestadores con >5.000 suscriptores urbanos
 *     (>5000 urbanos puros, o >5000 urbano+rural con >50% urbanos).
 *   - Subtítulo 2: prestadores con hasta 5.000 suscriptores en área
 *     urbana y rural (incluye rurales puros).
 *
 * El proyecto `sistema-epc` aplica la metodología CRA 825/2017 (Subtítulo
 * 2 con su metodología tarifaria por segmentos, vía el art. 8o de la 1032
 * que modifica el art. 2.1.3.2.1.1 de la 943).
 *
 * Fase 2 (`param-tarifa-res-825-compliance-phase2`).
 */

export type EstadoAmbito = 'APLICA' | 'NO_APLICA' | 'INDETERMINADO';

/** Subtítulo tarifario aplicable (Res CRA 1032/2026). */
export type SubtituloCRA = 1 | 2;

/**
 * Información mínima del prestador necesaria para evaluar el ámbito.
 * Se mantiene como interface separada del `Prestador` completo para
 * evitar acoplamiento: el módulo `ambito-tarifario` solo conoce estos
 * campos y nada más (pure-domain).
 */
export interface PrestadorAmbitoInfo {
  readonly id_prestador: number;
  /**
   * Cantidad de suscriptores totales al cierre del año de referencia
   * (Res CRA 1032/2026 art. 2.1.2.1.1.1: "a 31 de diciembre de 2024").
   *
   * `null` significa dato no configurado aún — el bootstrap lo inicializa
   * así para forzar al admin a configurar la cantidad antes de liquidar.
   */
  readonly cantidad_suscriptores: number | null;
  /** Zona principal de atención del prestador. */
  readonly zona: 'URBANA' | 'RURAL' | 'MIXTA';
}

/**
 * Resultado de evaluar el ámbito tarifario de un prestador.
 */
export interface ResultadoAmbito {
  /** Resultado de la evaluación. */
  readonly estado: EstadoAmbito;
  /** Subtítulo aplicable si `estado = 'APLICA'`. `null` en otro caso. */
  readonly subtitulo: SubtituloCRA | null;
  /** Norma tarifaria aplicable al prestador. `null` si `≠APLICA`. */
  readonly normaAplicable: string | null;
  /** Texto explicativo (se persiste en metadata de la Factura para auditoría). */
  readonly evidencia: string;
  /** ISO 8601 fecha/hora de la evaluación. */
  readonly fecha_verificacion: string;
}
