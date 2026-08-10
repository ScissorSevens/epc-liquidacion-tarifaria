/**
 * Wrapper `calcularLiquidacionConAmbito` — invoca gate `validarAmbito`
 * antes de delegar al motor puro `calcularLiquidacion`.
 *
 * Por qué existe como wrapper y no como parte de `calcularLiquidacion`:
 *   - El motor es pure function con 40 callers legacy (ver `grep` en
 *     commit anterior). Cambiar su firma para forzar `prestador`
 *     rompería toda la base.
 *   - El gate es de aplicación (Fase 4.x: `emitirFactura`,
 *     `bootstrapCompleto`), no de dominio puro. El motor
 *     `calcularLiquidacion` queda como función pura reusable.
 *   - Migrar todos los callers para que pasen `prestador` queda como
 *     tarea de Phase 4 (integración).
 *
 * Decisión documentada en `design.md` decisión 2 ("Gate validarAmbito
 * antes de liquidación como función wrapper").
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (task 2.8 GREEN).
 */

import { validarAmbito } from '../ambito-tarifario/validar-ambito';
import type {
  ParametrosTarifa,
  ResultadoCalculo,
  EntradaCalculo,
} from './types';
import type {
  AcuerdoMunicipal,
} from '../acuerdo-municipal';
import type { PrestadorAmbitoInfo } from '../ambito-tarifario/types';

const MENSAJES = {
  AMBITO_NO_APLICA: 'AMBITO_NO_APLICA: el prestador está fuera del ámbito de la metodología tarifaria configurada',
  AMBITO_INDETERMINADO: 'AMBITO_INDETERMINADO: cantidad de suscriptores del prestador no definida aún',
} as const;

/**
 * Igual a `calcularLiquidacion` pero invoca `validarAmbito` antes.
 *
 * @param entrada            Entrada del cálculo (con `id_prestador`).
 * @param parametros          ParametrosTarifa del prestador.
 * @param acuerdo             Acuerdo Municipal (puede ser null).
 * @param prestador           Información mínima del prestador para gate.
 * @param fecha_emision       ISO 8601 de la fecha del cálculo (también
 *                            puede venir en `entrada.fecha_emision`).
 * @returns                   ResultadoCalculo inmutable.
 * @throws                     Error con clave AMBITO_* si `validarAmbito`
 *                             retorna ≠APLICA.
 */
export function calcularLiquidacionConAmbito(
  entrada: EntradaCalculo & { fecha_emision?: string },
  parametros: ParametrosTarifa,
  acuerdo: AcuerdoMunicipal | null,
  prestador: PrestadorAmbitoInfo,
  fecha_emision?: string,
): ResultadoCalculo {
  const fecha = fecha_emision ?? entrada.fecha_emision ?? new Date().toISOString();
  const ambito = validarAmbito(prestador, fecha);

  if (ambito.estado === 'NO_APLICA') {
    throw new Error(`${MENSAJES.AMBITO_NO_APLICA} | evidencia: ${ambito.evidencia}`);
  }
  if (ambito.estado === 'INDETERMINADO') {
    throw new Error(`${MENSAJES.AMBITO_INDETERMINADO} | evidencia: ${ambito.evidencia}`);
  }

  // Lazy import para evitar ciclos entre módulos (motor ↔ ambito).
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { calcularLiquidacion } = require('./motor-tarifario');
  return calcularLiquidacion(entrada, parametros, acuerdo);
}
